import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import fs from "fs";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Try to log the raw incoming request before authentication
  try {
    const clonedReq = request.clone();
    const topic = clonedReq.headers.get("x-shopify-topic") || "UNKNOWN";
    const shop = clonedReq.headers.get("x-shopify-shop-domain") || "UNKNOWN";
    let payloadStr = "UNABLE_TO_READ_BODY";
    try {
      const body = await clonedReq.json();
      payloadStr = JSON.stringify(body, null, 2);
    } catch(e) {}
    
    const logData = `[${new Date().toISOString()}] RAW WEBHOOK ARRIVED (CREATE)\nTOPIC: ${topic}\nSHOP: ${shop}\nPAYLOAD:\n${payloadStr}\n\n----------------------------------------\n\n`;
    fs.appendFileSync("webhook_trigger.log", logData);
  } catch (err) {
    console.error("Failed to log raw webhook", err);
  }

  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request
  );

  if (!admin) {
    return new Response();
  }

  // Log the incoming payload to a file for debugging
  try {
    const logData = `[${new Date().toISOString()}] TOPIC: ${topic}\nPAYLOAD:\n${JSON.stringify(payload, null, 2)}\n\n----------------------------------------\n\n`;
    fs.appendFileSync("webhook_trigger.log", logData);
  } catch (err) {
    console.error("Failed to write to webhook_trigger.log", err);
  }

  // The payload contains the full SubscriptionContract object
  // Find the shop in the database
  const dbShop = await prisma.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!dbShop) {
    return new Response();
  }

  const webhookEvent = await prisma.webhookEvent.upsert({
    where: { shopifyWebhookId: request.headers.get("x-shopify-webhook-id") || String(Date.now()) },
    create: {
      shopId: dbShop.id,
      shopifyWebhookId: request.headers.get("x-shopify-webhook-id") || String(Date.now()),
      webhookTopic: topic,
      payload: payload as any,
      processingStatus: "PENDING",
      receivedDate: new Date(),
    },
    update: {}
  });

  try {

  // Shopify webhook payload uses snake_case keys
  const shopifyContractId = payload.id || payload.admin_graphql_api_id;
  const status = payload.status ? payload.status.toUpperCase() : "ACTIVE";
  const nextBillingDate = payload.next_billing_date || payload.nextBillingDate;
  const shopifyCustomerId = payload.customer_id || (payload.customer && payload.customer.id) || "";
  const customerEmail = payload.customer?.email || payload.email || null;
  const currencyCode = payload.currency_code || payload.currencyCode || "USD";

  let frequency = "MONTHLY";
  let interval = "MONTH";
  let intervalCount = 1;

  const billingPolicy = payload.billing_policy || payload.billingPolicy;
  if (billingPolicy) {
    interval = (billingPolicy.interval || "MONTH").toUpperCase();
    intervalCount = billingPolicy.interval_count || billingPolicy.intervalCount || 1;
    if (interval === "WEEK" && intervalCount === 1) frequency = "WEEKLY";
    if (interval === "WEEK" && intervalCount === 2) frequency = "FORTNIGHTLY";
  }

  await prisma.subscriptionContract.create({
    data: {
      shopId: dbShop.id,
      shopifyContractId: String(shopifyContractId),
      shopifyCustomerId: String(shopifyCustomerId),
      customerEmail,
      status: status,
      frequency: frequency as any,
      billingInterval: interval,
      billingIntervalCount: intervalCount,
      deliveryInterval: interval,
      deliveryIntervalCount: intervalCount,
      nextBillingDate: nextBillingDate ? new Date(nextBillingDate) : null,
      currencyCode: currencyCode,
    }
  });

    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processingStatus: "SUCCESS", processedDate: new Date() }
    });
  } catch (error: any) {
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processingStatus: "ERROR", errorMessage: error.message || "Unknown error", processedDate: new Date() }
    });
  }

  return new Response();
};
