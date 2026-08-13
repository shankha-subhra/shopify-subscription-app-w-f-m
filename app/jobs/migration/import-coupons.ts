import { importCouponsToShopify } from "../../services/migration/coupon-import.server";

export async function processCouponMigration(payload: { shop: string, session: any }) {
  console.log("Starting coupon migration job...");
  await importCouponsToShopify(payload.shop, payload.session);
}
