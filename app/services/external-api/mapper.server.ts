import db from "../../db.server";

export async function resolveShopifyId(shop: string, entityType: string, externalId: string) {
  const mapping = await db.externalSyncMapping.findUnique({
    where: {
      shop_entityType_externalId: {
        shop,
        entityType,
        externalId: String(externalId),
      },
    },
  });

  return mapping;
}

export async function saveMapping(shop: string, entityType: string, externalId: string, shopifyId: string) {
  await db.externalSyncMapping.upsert({
    where: {
      shop_entityType_externalId: {
        shop,
        entityType,
        externalId: String(externalId),
      },
    },
    create: {
      shop,
      entityType,
      externalId: String(externalId),
      shopifyId,
      status: "SYNCED",
    },
    update: {
      shopifyId,
      status: "SYNCED",
      updatedAt: new Date(),
    },
  });
}
