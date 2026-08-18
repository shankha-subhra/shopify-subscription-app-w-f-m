import { containsAny, extractProductName } from "./intent-helpers.server";

export function parseReviewCommand(message: string): any {
  // 1. List / Filter Reviews Intent
  if (containsAny(message, ["show", "list", "view", "get", "what", "which", "how many"])) {
    let filter = "ALL";
    if (containsAny(message, ["pending", "waiting"])) filter = "PENDING";
    if (containsAny(message, ["approved", "active"])) filter = "APPROVED";
    if (containsAny(message, ["rejected", "spam"])) filter = "REJECTED";

    let rating = null;
    const ratingMatch = message.match(/(\d)(?:-|\s)?star/i);
    if (ratingMatch && ratingMatch[1]) {
      rating = parseInt(ratingMatch[1], 10);
    }

    return {
      intent: "list_reviews",
      confidence: 1,
      parameters: {
        filter,
        rating,
        productName: extractProductName(message)
      }
    };
  }

  // 2. Approve Review Intent
  if (containsAny(message, ["approve", "accept", "publish"])) {
    return {
      intent: "approve_review",
      confidence: 1,
      parameters: {
        productName: extractProductName(message)
      }
    };
  }

  // 3. Reject Review Intent
  if (containsAny(message, ["reject", "delete", "remove", "spam"])) {
    return {
      intent: "reject_review",
      confidence: 1,
      parameters: {
        productName: extractProductName(message)
      }
    };
  }

  // 4. Create Review Attempt Intent
  if (containsAny(message, ["create", "add", "new", "make"]) && containsAny(message, ["review", "feedback"])) {
    return {
      intent: "review_create_help",
      confidence: 1,
      parameters: {}
    };
  }

  // 5. Help / Settings Intent
  if (containsAny(message, ["setting", "settings", "instruction", "how to", "change", "setup"])) {
    return {
      intent: "review_settings_help",
      confidence: 1,
      parameters: {}
    };
  }

  return { intent: "unknown", confidence: 0 };
}
