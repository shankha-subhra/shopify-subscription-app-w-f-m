import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    return new Response();
  }

  const dbShop = await prisma.shop.findFirst({ where: { shopDomain: shop } });
  if (!dbShop) {
    return new Response();
  }

  // Shopify's GraphQL Webhooks for Subscriptions send the ID
  // e.g. payload: { admin_graphql_api_id: "gid://shopify/SubscriptionContract/123" }
  // We'll query Shopify for the full details instead of relying on the payload schema
  
  if (topic === "SUBSCRIPTION_CONTRACTS_CREATE" || topic === "SUBSCRIPTION_CONTRACTS_UPDATE") {
    const contractId = payload.admin_graphql_api_id;
    if (!contractId) return new Response();

    try {
      const response = await admin.graphql(
        `#graphql
        query getContract($id: ID!) {
          subscriptionContract(id: $id) {
            id
            status
            nextBillingDate
            currencyCode
            customer { id email }
            billingPolicy { interval intervalCount }
            deliveryPolicy { interval intervalCount }
            lines(first: 50) {
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
        }`,
        { variables: { id: contractId } }
      );

      const responseJson = await response.json();
      const c = responseJson.data?.subscriptionContract;

      if (c) {
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

        for (const lineEdge of c.lines?.edges || []) {
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
    } catch (e) {
      console.error("Webhook processing error:", e);
    }
  }

  return new Response();
};
