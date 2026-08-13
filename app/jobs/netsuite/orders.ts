import { createNetSuiteSalesOrder } from "../../services/netsuite/order.server";

export async function handleOrderSyncJob(payload: { shop: string, shopifyOrderId: string, operation: string }) {
  console.log("Processing Shopify to NetSuite order sync", payload);
  // Fetch shopify order and push to NetSuite
}
