import { importCategoriesToShopify } from "../../services/migration/category-import.server";

export async function processCategoryMigration(payload: { shop: string, session: any }) {
  console.log("Starting category migration job...");
  await importCategoriesToShopify(payload.shop, payload.session);
}
