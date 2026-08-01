import { PrismaClient } from '@prisma/client';
import { createAdminRestApiClient } from '@shopify/admin-api-client';

const prisma = new PrismaClient();

async function syncContracts() {
  const session = await prisma.session.findFirst({
    where: { shop: { contains: "app-testing-subscription.myshopify.com" } }
  });

  if (!session) {
    console.log("No session found!");
    return;
  }

  const shop = session.shop;
  const token = session.accessToken;
  const dbShop = await prisma.shop.findFirst({ where: { shopDomain: shop } });
  if (!dbShop) return;

  const response = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token
    },
    body: JSON.stringify({
      query: `
        query {
          subscriptionContracts(first: 50) {
            edges {
              node {
                id
                status
                nextBillingDate
                currencyCode
                customer {
                  id
                  email
                }
                billingPolicy {
                  interval
                  intervalCount
                }
                deliveryPolicy {
                  interval
                  intervalCount
                }
                lines(first: 10) {
                  edges {
                    node {
                      id
                      title
                      variantTitle
                      quantity
                      productId
                      variantId
                      currentPrice { amount }
                    }
                  }
                }
              }
            }
          }
        }
      `
    })
  });

  const data = await response.json();
  const contracts = data.data?.subscriptionContracts?.edges || [];
  console.log(`[${new Date().toISOString()}] Background Sync: Found ${contracts.length} contracts.`);

  for (const edge of contracts) {
    const c = edge.node;

    const billingInterval = c.billingPolicy?.interval || "MONTH";
    const frequencyType = billingInterval === "WEEK" && c.billingPolicy?.intervalCount === 1 ? "WEEKLY" :
                          billingInterval === "WEEK" && c.billingPolicy?.intervalCount === 2 ? "FORTNIGHTLY" : "MONTHLY";

    const contract = await prisma.subscriptionContract.upsert({
      where: {
        id: (await prisma.subscriptionContract.findFirst({ where: { shopifyContractId: String(c.id) } }))?.id || -1
      },
      update: {
        status: c.status,
        nextBillingDate: c.nextBillingDate ? new Date(c.nextBillingDate) : null,
      },
      create: {
        shopId: dbShop.id,
        shopifyContractId: String(c.id),
        shopifyCustomerId: c.customer?.id ? String(c.customer.id) : "",
        customerEmail: c.customer?.email || "",
        status: c.status,
        frequency: frequencyType,
        billingInterval: c.billingPolicy?.interval || "MONTH",
        billingIntervalCount: c.billingPolicy?.intervalCount || 1,
        deliveryInterval: c.deliveryPolicy?.interval || "MONTH",
        deliveryIntervalCount: c.deliveryPolicy?.intervalCount || 1,
        nextBillingDate: c.nextBillingDate ? new Date(c.nextBillingDate) : null,
        currencyCode: c.currencyCode || "USD",
      }
    });

    await prisma.subscriptionContractLine.deleteMany({ where: { subscriptionContractId: contract.id } });

    for (const lineEdge of c.lines.edges) {
      const line = lineEdge.node;
      await prisma.subscriptionContractLine.create({
        data: {
          subscriptionContractId: contract.id,
          shopifyContractLineId: String(line.id),
          shopifyProductId: line.productId ? String(line.productId) : "",
          shopifyVariantId: line.variantId ? String(line.variantId) : "",
          productTitle: line.title,
          variantTitle: line.variantTitle || "",
          quantity: line.quantity,
          currentPrice: parseFloat(line.currentPrice?.amount || "0")
        }
      });
    }
  }
}

async function main() {
  console.log("Starting 1-minute background sync...");
  await syncContracts(); // run immediately once
  setInterval(async () => {
    try {
      await syncContracts();
    } catch (e) {
      console.error("Sync failed:", e);
    }
  }, 60 * 1000);
}

main();
