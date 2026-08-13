import { importInventoryToShopify } from "../../services/migration/inventory-import.server";

export async function processInventoryMigration(payload: { shop: string, session: any, inventoryData: any[] }) {
  console.log("Starting inventory migration job...");
  await importInventoryToShopify(payload.shop, payload.session, payload.inventoryData);
}
