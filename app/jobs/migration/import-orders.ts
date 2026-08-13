import { importOrdersToShopify } from "../../services/migration/order-import.server";

export async function processOrderMigration(payload: { shop: string, session: any }) {
  console.log("Starting order migration job...");
  await importOrdersToShopify(payload.shop, payload.session);
}
