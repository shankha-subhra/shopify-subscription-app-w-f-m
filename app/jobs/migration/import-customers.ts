import { importCustomersToShopify } from "../../services/migration/customer-import.server";

export async function processCustomerMigration(payload: { shop: string, session: any }) {
  console.log("Starting customer migration job...");
  await importCustomersToShopify(payload.shop, payload.session);
}
