import { NetSuiteClient } from "./client.server";

export async function syncNetSuiteProductToShopify(shop: string, netsuiteItemId: string) {
  const client = new NetSuiteClient(shop);
  const item = await client.get(`/record/v1/inventoryitem/${netsuiteItemId}`);
  
  // Transform NetSuite item to Shopify Product
  // Sync to Shopify via GraphQL Admin API
  
  console.log(`Synced product ${netsuiteItemId} for shop ${shop}`);
}
