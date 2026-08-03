import { findMostSpecificLocationRule } from "./location-matcher.server";

export function calculateShippingRate({
  cartQuantity,
  destination,
  rules,
  settings,
}: {
  cartQuantity: number;
  destination: any;
  rules: any[];
  settings: any;
}) {
  if (!settings?.isEnabled) {
    return null;
  }

  const matchingRule = findMostSpecificLocationRule(
    rules.filter((rule) => rule.isActive),
    destination
  );

  if (matchingRule) {
    return {
      serviceName: matchingRule.shippingMethodName || "Location Shipping",
      serviceCode: matchingRule.serviceCode || `RULE_${matchingRule.id}`,
      price: matchingRule.isFreeShipping ? 0 : Number(matchingRule.shippingPrice),
      currency: matchingRule.currency || settings.currency,
      source: "location_rule",
      matchedRuleId: matchingRule.id,
      matchedRuleName: matchingRule.ruleName,
    };
  }

  if (cartQuantity >= settings.quantityThreshold) {
    return {
      serviceName: settings.atOrAboveThresholdMethodName || "Bulk Shipping",
      serviceCode: "QUANTITY_AT_OR_ABOVE_THRESHOLD",
      price: Number(settings.atOrAboveThresholdPrice),
      currency: settings.currency,
      source: "quantity_rule",
    };
  }

  return {
    serviceName: settings.belowThresholdMethodName || "Standard Shipping",
    serviceCode: "QUANTITY_BELOW_THRESHOLD",
    price: Number(settings.belowThresholdPrice),
    currency: settings.currency,
    source: "quantity_rule",
  };
}
