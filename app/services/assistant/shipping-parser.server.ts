import { 
  containsAny, 
  extractMoney, 
  extractQuantity,
  extractStatus,
  extractRuleName
} from "./intent-helpers.server";

export function parseShippingCommand(message: string): any {
  // 1. Create Rule Intent
  if (
    containsAny(message, ["create", "add", "new", "make"]) &&
    containsAny(message, ["shipping", "delivery", "rate"])
  ) {
    let conditionType = "ORDER_VALUE";
    let operator = "GREATER_THAN_OR_EQUAL";
    let conditionValue = 0;
    let shippingPrice = 0;

    if (containsAny(message, ["free shipping", "free"])) {
      shippingPrice = 0;
    } else {
      const moneyMatch = extractMoney(message);
      if (moneyMatch !== null) {
        shippingPrice = moneyMatch;
      }
    }

    if (containsAny(message, ["above", "over", "greater", "more than"])) {
      operator = "GREATER_THAN_OR_EQUAL";
      conditionValue = extractMoney(message.replace(shippingPrice.toString(), "")) || 0;
    } else if (containsAny(message, ["below", "under", "less than"])) {
      operator = "LESS_THAN";
      conditionValue = extractMoney(message.replace(shippingPrice.toString(), "")) || 0;
    } else if (containsAny(message, ["items", "quantity", "cart has"])) {
      conditionType = "CART_QUANTITY";
      conditionValue = extractQuantity(message) || 0;
    }

    return {
      intent: "create_shipping_rule",
      confidence: 1,
      parameters: {
        conditionType,
        operator,
        conditionValue,
        shippingPrice
      }
    };
  }

  // 2. Change Status Intent
  const status = extractStatus(message);
  if (status && containsAny(message, ["change", "set", "make", "turn", "update", "mark", "activate", "deactivate", "enable", "disable"])) {
    return {
      intent: "change_shipping_status",
      confidence: 1,
      parameters: {
        status: status,
        ruleName: extractRuleName(message)
      }
    };
  }

  // 3. List Rules Intent
  if (containsAny(message, ["show", "list", "view", "what", "which"]) && containsAny(message, ["shipping", "rules", "rates"])) {
    let filter = "ALL";
    if (containsAny(message, ["active", "enabled", "on"])) filter = "ACTIVE";
    if (containsAny(message, ["inactive", "disabled", "off"])) filter = "INACTIVE";

    return {
      intent: "list_shipping_rules",
      confidence: 1,
      parameters: { filter }
    };
  }

  return { intent: "unknown", confidence: 0 };
}
