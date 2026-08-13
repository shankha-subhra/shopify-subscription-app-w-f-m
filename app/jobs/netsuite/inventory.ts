export async function handleInventorySyncJob(payload: { shop: string, netsuiteItemId: string, quantity: number }) {
  console.log("Processing NetSuite inventory sync", payload);
  // Update inventory level in Shopify
}
