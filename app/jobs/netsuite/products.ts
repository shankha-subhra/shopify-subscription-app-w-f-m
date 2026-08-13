import { syncNetSuiteProductToShopify } from "../../services/netsuite/product.server";

export async function handleProductSyncJob(payload: { shop: string, netsuiteId: string, operation: string }) {
  console.log("Processing NetSuite product sync", payload);
  await syncNetSuiteProductToShopify(payload.shop, payload.netsuiteId);
}
