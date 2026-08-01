import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request
  );

  if (!admin) {
    return new Response();
  }

  // The payload contains the full SubscriptionContract object
  // Find the shop in the database
  const dbShop = await prisma.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!dbShop) {
    return new Response();
  }

  const { id: shopifyContractId, status, nextBillingDate, customer, currencyCode } = payload;
  const customerEmail = customer?.email || null;
  const shopifyCustomerId = customer?.id || "";

  // Because the Webhook payload doesn't perfectly match our DB enum in all cases,
  // we extract frequency safely
  let frequency = "MONTHLY";
  let interval = "MONTH";
  let intervalCount = 1;

  if (payload.billingPolicy) {
    interval = payload.billingPolicy.interval;
    intervalCount = payload.billingPolicy.intervalCount;
    if (interval === "WEEK" && intervalCount === 1) frequency = "WEEKLY";
    if (interval === "WEEK" && intervalCount === 2) frequency = "FORTNIGHTLY";
  }

  await prisma.subscriptionContract.create({
    data: {
      shopId: dbShop.id,
      shopifyContractId,
      shopifyCustomerId,
      customerEmail,
      status: status,
      frequency: frequency as any,
      billingInterval: interval,
      billingIntervalCount: intervalCount,
      deliveryInterval: interval,
      deliveryIntervalCount: intervalCount,
      nextBillingDate: nextBillingDate ? new Date(nextBillingDate) : null,
      currencyCode: currencyCode || "USD",
    }
  });

  return new Response();
};
