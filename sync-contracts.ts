import { PrismaClient } from '@prisma/client';
import { createAdminRestApiClient } from '@shopify/admin-api-client';

const prisma = new PrismaClient();

async function main() {
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
  console.log(`Found ${contracts.length} contracts on Shopify.`);

  for (const edge of contracts) {
    const c = edge.node;
    console.log("Syncing contract:", c.id);

    const billingInterval = c.billingPolicy?.interval || "MONTH";
    const frequencyType = billingInterval === "WEEK" && c.billingPolicy?.intervalCount === 1 ? "WEEKLY" :
                          billingInterval === "WEEK" && c.billingPolicy?.intervalCount === 2 ? "FORTNIGHTLY" : "MONTHLY";

    const contract = await prisma.subscriptionContract.upsert({
      where: {
        id: (await prisma.subscriptionContract.findFirst({ where: { shopifyContractId: c.id } }))?.id || -1
      },
      update: {
        status: c.status,
        nextBillingDate: c.nextBillingDate ? new Date(c.nextBillingDate) : null,
      },
      create: {
        shopId: dbShop.id,
        shopifyContractId: c.id,
        shopifyCustomerId: c.customer?.id || "",
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

    // Delete existing lines and recreate
    await prisma.subscriptionContractLine.deleteMany({ where: { subscriptionContractId: contract.id } });

    for (const lineEdge of c.lines.edges) {
      const line = lineEdge.node;
      await prisma.subscriptionContractLine.create({
        data: {
          subscriptionContractId: contract.id,
          shopifyContractLineId: line.id,
          shopifyProductId: line.productId || "",
          shopifyVariantId: line.variantId || "",
          productTitle: line.title,
          variantTitle: line.variantTitle || "",
          quantity: line.quantity,
          currentPrice: parseFloat(line.currentPrice?.amount || "0")
        }
      });
    }
  }
  
  console.log("Done syncing!");
}

main().catch(console.error);
