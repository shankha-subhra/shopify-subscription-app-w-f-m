export function containsAny(message: string, keywords: string[]): boolean {
  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
}

export function extractPercentage(message: string): number | null {
  const match = message.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/i);
  if (match && match[1]) {
    return parseFloat(match[1]);
  }
  return null;
}

export function extractMoney(message: string): number | null {
  // Looks for $10, 10$, 10.00
  const match = message.match(/(?:\$|usd)?\s*(\d+(?:\.\d+)?)\s*(?:\$|usd)?/i);
  if (match && match[1]) {
    return parseFloat(match[1]);
  }
  return null;
}

export function extractQuantity(message: string): number | null {
  const match = message.match(/(\d+)\s*(?:or more|items?|products?)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

export function extractFrequency(message: string): "DAY" | "WEEK" | "MONTH" | "YEAR" | null {
  if (containsAny(message, ["daily", "every day", "day"])) return "DAY";
  if (containsAny(message, ["weekly", "every week", "week"])) return "WEEK";
  if (containsAny(message, ["monthly", "every month", "month"])) return "MONTH";
  if (containsAny(message, ["yearly", "annually", "every year", "year"])) return "YEAR";
  return null;
}

export function extractStatus(message: string): "ACTIVE" | "INACTIVE" | null {
  if (containsAny(message, ["disable", "inactive", "pause", "stop", "deactivate"])) return "INACTIVE";
  if (containsAny(message, ["enable", "active", "start", "activate"])) return "ACTIVE";
  return null;
}

// Very basic product name extractor (everything after "for" or "from", or capitalized words)
export function extractProductName(message: string): string | null {
  const match = message.match(/(?:for|from|remove|add)\s+([A-Z][a-zA-Z\s]+)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

export function extractRuleName(message: string): string | null {
  const match = message.match(/(?:for|rule|plan|subscription)\s+([A-Z][a-zA-Z\s]+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}
