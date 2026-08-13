import { resolveShopifyId, saveMapping } from "../external-api/mapper.server";

export async function importInventoryToShopify(shop: string, session: any, inventoryData: any[]) {
  // Sync available_quantity to Shopify InventoryItemGid
}
