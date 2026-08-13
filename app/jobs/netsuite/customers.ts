import { syncNetSuiteCustomerToShopify, syncShopifyCustomerToNetSuite } from "../../services/netsuite/customer.server";

export async function handleCustomerSyncJob(payload: { shop: string, id: string, source: "NETSUITE" | "SHOPIFY" }) {
  console.log("Processing customer sync", payload);
  if (payload.source === "NETSUITE") {
    await syncNetSuiteCustomerToShopify(payload.shop, payload.id);
  } else {
    await syncShopifyCustomerToNetSuite(payload.shop, payload.id);
  }
}
