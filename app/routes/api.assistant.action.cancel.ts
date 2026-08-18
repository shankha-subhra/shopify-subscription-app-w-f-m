import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { cancelPendingAction } from "../services/assistant/pending-actions.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const actionId = formData.get("actionId") as string;

  if (!actionId) return json({ error: "Action ID is required" }, { status: 400 });

  try {
    await cancelPendingAction(actionId, session.shop);
    return json({
      success: true,
      messages: [
        {
          type: "message",
          message: "Operation cancelled. No changes were made."
        },
        {
          type: "requires_input",
          inputType: "options",
          message: "**What would you like to do with your subscription?**",
          actionId: "menu",
          data: { options: ["Add a Plan", "Add products to a Plan", "Show all active subscription rules"] }
        }
      ]
    });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
};
