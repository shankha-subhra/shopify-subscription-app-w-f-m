import { importProductsToShopify } from "../../services/migration/product-import.server";

export async function processProductMigration(payload: { shop: string, session: any }) {
  console.log("Starting product migration job...");
  await importProductsToShopify(payload.shop, payload.session);
}
