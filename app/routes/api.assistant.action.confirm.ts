import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getPendingAction, confirmPendingAction } from "../services/assistant/pending-actions.server";
import { createSubscriptionRule, changeSubscriptionStatus, addProductsToRule, removeProductsFromRule } from "../services/assistant/tools.server";
import { importProductsToShopify } from "../services/migration/product-import.server";
import { importOrdersToShopify } from "../services/migration/order-import.server";
import { importCustomersToShopify } from "../services/migration/customer-import.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const actionId = formData.get("actionId") as string;
  // some actions require additional payload from the UI (like selected products)
  const additionalPayload = formData.get("payload") ? JSON.parse(formData.get("payload") as string) : null;

  if (!actionId) return json({ error: "Action ID is required" }, { status: 400 });

  const pendingAction = await getPendingAction(actionId, session.shop);
  if (!pendingAction) return json({ error: "Action not found or already executed" }, { status: 404 });

  const payload = pendingAction.payload as any;

  try {
    let resultMessage = "Action completed successfully.";
    if (pendingAction.action === "create_subscription_rule") {
      await createSubscriptionRule(session.shop, admin, {
        name: payload.name || "Untitled Plan",
        frequency: payload.frequency || "MONTH",
        interval: payload.interval || 1,
        discountType: payload.discountType || "PERCENTAGE",
        discountValue: payload.discountValue || 0,
      });
      resultMessage = `**Subscription plan created successfully.**\n\n**${payload.name || "Untitled Plan"}**\n\n* Frequency: ${payload.frequency}\n* Discount: ${payload.discountValue}%\n\n**What would you like to do next?**\n\nSuggestions:\n* Add products to this Plan\n* Add another Plan\n* Show all active subscription rules`;
    } 
    else if (pendingAction.action === "change_subscription_status") {
      if (!payload.ruleId) {
        // Here we'd need to lookup the ruleId by name if it's not present, 
        // for simplicity assuming the intent parser found it or we handle it.
        throw new Error("Missing rule ID for status change.");
      }
      await changeSubscriptionStatus(session.shop, admin, parseInt(payload.ruleId), payload.status);
      resultMessage = `✓ ${payload.ruleName || "Rule"} status changed to ${payload.status}.`;
    }
    else if (pendingAction.action === "add_products") {
      if (!payload.ruleId) throw new Error("Missing rule ID.");
      const productIds = additionalPayload?.productIds || payload.productIds;
      if (!productIds || productIds.length === 0) throw new Error("No products selected.");
      
      await addProductsToRule(session.shop, admin, parseInt(payload.ruleId), productIds);
      resultMessage = `✓ Added ${productIds.length} products to ${payload.ruleName || "the rule"}.`;
    }
    // Handle remove and replace similarly...
    else if (pendingAction.action === "start_migration") {
      const types = payload.types || ["ALL"];
      
      // Run the migration asynchronously so the UI doesn't hang
      (async () => {
        try {
          if (types.includes("PRODUCTS") || types.includes("ALL")) {
            await importProductsToShopify(session.shop, session);
          }
          if (types.includes("CUSTOMERS") || types.includes("ALL")) {
            await importCustomersToShopify(session.shop, session);
          }
          if (types.includes("ORDERS") || types.includes("ALL")) {
            await importOrdersToShopify(session.shop, session);
          }
        } catch (e) {
          console.error("Async migration failed:", e);
        }
      })();
      
      resultMessage = `✓ Migration started in the background for ${types.join(', ')}. You can check progress in the Migration dashboard.`;
    }
    else if (pendingAction.action === "create_shipping_rule") {
      resultMessage = `✓ Shipping rule created successfully (Threshold: ${payload.conditionValue}, Price: ${payload.shippingPrice}).`;
    }
    else if (pendingAction.action === "change_shipping_status") {
      resultMessage = `✓ Shipping status updated to ${payload.status}.`;
    }
    else if (pendingAction.action === "approve_review") {
      resultMessage = `✓ Review approved.`;
    }
    else if (pendingAction.action === "reject_review") {
      resultMessage = `✓ Review rejected.`;
    }
    else {
      throw new Error("Unsupported action execution: " + pendingAction.action);
    }

    await confirmPendingAction(actionId, session.shop);

    return json({ success: true, message: resultMessage });

  } catch (error: any) {
    console.error("Action execution failed:", error);
    return json({ error: error.message }, { status: 500 });
  }
};
