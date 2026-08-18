import { 
  containsAny, 
  extractFrequency, 
  extractPercentage, 
  extractStatus, 
  extractRuleName,
  extractProductName
} from "./intent-helpers.server";

export function parseSubscriptionCommand(message: string): any {
  // 1. Add Products Intent (Check first since 'add products to a plan' contains both 'add' and 'plan')
  if (containsAny(message, ["add product", "add products", "assign product", "assign products", "select product", "select products"])) {
    return {
      intent: "add_products",
      confidence: 1,
      parameters: {
        ruleName: extractRuleName(message)
      }
    };
  }

  // 2. Create Rule Intent
  if (
    containsAny(message, ["create", "add", "new", "make"]) &&
    containsAny(message, ["subscription", "plan", "rule"])
  ) {
    return {
      intent: "create_subscription_rule",
      confidence: 1,
      parameters: {
        frequency: extractFrequency(message) || null,
        interval: 1,
        discountType: "PERCENTAGE",
        discountValue: extractPercentage(message)
      }
    };
  }

  // 2. Change Status Intent
  const status = extractStatus(message);
  if (status && containsAny(message, ["change", "set", "make", "turn", "update", "mark", "activate", "deactivate", "enable", "disable"])) {
    return {
      intent: "change_subscription_status",
      confidence: 1,
      parameters: {
        status: status,
        ruleName: extractRuleName(message)
      }
    };
  }


  // 4. Remove Products Intent
  if (containsAny(message, ["remove product", "remove products", "delete product"])) {
    return {
      intent: "remove_products",
      confidence: 1,
      parameters: {
        productName: extractProductName(message),
        ruleName: extractRuleName(message)
      }
    };
  }

  // 5. List Rules Intent
  if (containsAny(message, ["show", "list", "view", "what", "which"]) && containsAny(message, ["plans", "subscriptions", "rules"])) {
    let filter = "ALL";
    if (containsAny(message, ["active", "enabled", "on"])) filter = "ACTIVE";
    if (containsAny(message, ["inactive", "disabled", "off"])) filter = "INACTIVE";

    return {
      intent: "list_subscription_rules",
      confidence: 1,
      parameters: { filter }
    };
  }

  return { intent: "unknown", confidence: 0 };
}
