import { fetchExternalCoupons } from "../external-api/coupons.server";
import { resolveShopifyId, saveMapping } from "../external-api/mapper.server";
import { logCreation } from "./logger.server";
import { unauthenticated } from "../../shopify.server";
import db from "../../db.server";

export async function importCouponsToShopify(shop: string, session: any) {
  const coupons = await fetchExternalCoupons(shop);
  const { admin } = await unauthenticated.admin(shop);

  for (const coupon of coupons) {
    let currentInput: any = null;
    try {
      const couponId = coupon.id || coupon._id || String(Math.random()).substr(2, 9);
      const existingMap = await resolveShopifyId(shop, 'coupon', couponId);
      
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const input = {
        title: coupon.code,
        code: coupon.code,
        startsAt: pastDate.toISOString(),
        customerSelection: { all: true },
        customerGets: {
          value: {
            percentage: coupon.discount_percent ? coupon.discount_percent / 100 : 0.1
          },
          items: { all: true }
        },
        usageLimit: 100
      };
      
      currentInput = input;
      let responseData: any = null;
      let shopifyId = existingMap?.shopifyId;

      if (existingMap && existingMap.shopifyId) {
        const response = await admin.graphql(
          `#graphql
            mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
              discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
                codeDiscountNode { id }
                userErrors { field message }
              }
            }`,
          { variables: { id: existingMap.shopifyId, basicCodeDiscount: input } }
        );
        const { data } = await response.json();
        responseData = data;
        logCreation(shop, 'coupon-update', '/graphql.json', { id: existingMap.shopifyId, basicCodeDiscount: input }, data);
        
        if (data?.discountCodeBasicUpdate?.userErrors?.length > 0) {
          throw new Error(data.discountCodeBasicUpdate.userErrors.map((e: any) => e.message).join(", "));
        }
      } else {
        const response = await admin.graphql(
          `#graphql
            mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
              discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
                codeDiscountNode { id }
                userErrors { field message }
              }
            }`,
          { variables: { basicCodeDiscount: input } }
        );
        const { data } = await response.json();
        responseData = data;
        logCreation(shop, 'coupon-create', '/graphql.json', input, data);
        
        if (data?.discountCodeBasicCreate?.userErrors?.length > 0) {
          throw new Error(data.discountCodeBasicCreate.userErrors.map((e: any) => e.message).join(", "));
        } else if (data?.discountCodeBasicCreate?.codeDiscountNode?.id) {
          shopifyId = data.discountCodeBasicCreate.codeDiscountNode.id;
          await saveMapping(shop, 'coupon', coupon.id, shopifyId);
        }
      }

      await db.externalSyncLog.create({
        data: {
          shop,
          entityType: 'coupon',
          externalId: String(couponId),
          shopifyId: shopifyId,
          endpoint: '/graphql.json',
          status: 'SUCCESS',
          requestPayload: JSON.stringify(currentInput),
          responsePayload: JSON.stringify(responseData)
        }
      });
    } catch (error: any) {
      const couponId = coupon.id || coupon._id || 'unknown';
      console.error(`[importCouponsToShopify] Failed for coupon ${couponId}:`, error.message);
      await db.externalSyncLog.create({
        data: {
          shop,
          entityType: 'coupon',
          externalId: String(couponId),
          endpoint: '/graphql.json',
          status: 'FAILED',
          requestPayload: currentInput ? JSON.stringify(currentInput) : JSON.stringify(coupon),
          errorMessage: error.message || 'Unknown error'
        }
      });
    }
  }
}
