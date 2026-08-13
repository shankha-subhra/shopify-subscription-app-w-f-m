import { NetSuiteClient } from "./client.server";

export async function createNetSuiteSalesOrder(shop: string, shopifyOrderData: any) {
  const client = new NetSuiteClient(shop);
  // Transform Shopify order to NetSuite Sales Order structure
  // POST to NetSuite
}
