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

  const dbShop = await prisma.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!dbShop) {
    return new Response();
  }

  const { id: shopifyContractId, status, nextBillingDate, customer, currencyCode } = payload;
  const customerEmail = customer?.email || null;
  const shopifyCustomerId = customer?.id || "";

  let frequency = "MONTHLY";
  let interval = "MONTH";
  let intervalCount = 1;

  if (payload.billingPolicy) {
    interval = payload.billingPolicy.interval;
    intervalCount = payload.billingPolicy.intervalCount;
    if (interval === "WEEK" && intervalCount === 1) frequency = "WEEKLY";
    if (interval === "WEEK" && intervalCount === 2) frequency = "FORTNIGHTLY";
  }

  // Find the contract ID first
  const existingContract = await prisma.subscriptionContract.findFirst({
    where: { shopifyContractId }
  });

  if (existingContract) {
    await prisma.subscriptionContract.update({
      where: { id: existingContract.id },
      data: {
        status: status,
        nextBillingDate: nextBillingDate ? new Date(nextBillingDate) : null,
      }
    });
  }

  return new Response();
};
