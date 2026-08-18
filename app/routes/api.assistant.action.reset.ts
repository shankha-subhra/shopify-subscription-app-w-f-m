import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { resetAllPendingActions } from "../services/assistant/pending-actions.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    await resetAllPendingActions(session.shop);
    return json({ success: true, message: "All pending conversations reset." });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
};
