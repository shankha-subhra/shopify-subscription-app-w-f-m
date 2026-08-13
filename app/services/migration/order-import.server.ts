import { fetchExternalOrders } from "../external-api/orders.server";
import { resolveShopifyId, saveMapping } from "../external-api/mapper.server";
import { logCreation } from "./logger.server";
import { unauthenticated } from "../../shopify.server";
import db from "../../db.server";

export async function importOrdersToShopify(shop: string, session: any) {
  const orders = await fetchExternalOrders(shop);
  const { admin } = await unauthenticated.admin(shop);

  for (const order of orders) {
    let currentInput: any = null;
    try {
      const existingMap = await resolveShopifyId(shop, 'order', order.id);
      if (existingMap && existingMap.shopifyId) {
        // Skip updating historical orders for now, usually orders are immutable
        continue;
      }

      // 1. Resolve Customer mapping
      const customerMap = await resolveShopifyId(shop, 'customer', order.userId);
      let customerId = null;
      if (customerMap && customerMap.shopifyId) {
        // Extract numeric ID from gid://shopify/Customer/12345
        customerId = customerMap.shopifyId.split("/").pop();
      }

      // 2. Resolve Product/Variant mappings (Order Items)
      const lineItems = [];
      for (const item of order.products) {
        const productMap = await resolveShopifyId(shop, 'product', item.productId);
        if (productMap && productMap.shopifyId) {
           // We need a variant ID, but for historical import, Shopify allows product_id
           // Extract numeric ID
           const productId = productMap.shopifyId.split("/").pop();
           lineItems.push({
             product_id: productId,
             quantity: item.quantity
           });
        }
      }
      
      if (lineItems.length === 0) {
         throw new Error("No products could be mapped for this order. Ensure products are imported first.");
      }

      const input = {
        session: admin.session,
        customer: customerId ? { id: customerId } : undefined,
        line_items: lineItems,
        processed_at: new Date(order.date).toISOString(),
        financial_status: "paid",
        transactions: [{
          kind: "sale",
          status: "success",
          amount: 0.0 // Defaulting as FakeStore doesn't provide order totals natively
        }]
      };
      
      currentInput = input;

      // 3. Push to Shopify via REST API
      const response = await admin.rest.resources.Order.save(input as any);
      logCreation(shop, 'order-create', '/orders.json', input, response);

      if (response && (response as any).id) {
         const shopifyId = `gid://shopify/Order/${(response as any).id}`;
         await saveMapping(shop, 'order', order.id, shopifyId);
         
         await db.externalSyncLog.create({
          data: {
            shop,
            entityType: 'order',
            externalId: String(order.id),
            shopifyId: shopifyId,
            endpoint: '/orders.json',
            status: 'SUCCESS',
            requestPayload: JSON.stringify(currentInput),
            responsePayload: JSON.stringify(response)
          }
         });
      }

    } catch (error: any) {
      console.error(`[importOrdersToShopify] Failed for order ${order.id}:`, error.message);
      await db.externalSyncLog.create({
        data: {
          shop,
          entityType: 'order',
          externalId: String(order.id),
          endpoint: '/orders.json',
          status: 'FAILED',
          requestPayload: currentInput ? JSON.stringify(currentInput) : JSON.stringify(order),
          errorMessage: error.message || 'Unknown error'
        }
      });
    }
  }
}
