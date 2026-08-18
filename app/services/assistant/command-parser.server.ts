import { parseSubscriptionCommand } from "./subscription-parser.server";
import { parseShippingCommand } from "./shipping-parser.server";
import { parseReviewCommand } from "./review-parser.server";
import { parseMigrationCommand } from "./migration-parser.server";

export interface ParseCommandArgs {
  section: string;
  message: string;
  shop: string;
}

export async function parseAssistantCommand({ section, message, shop }: ParseCommandArgs) {
  let parsed = { intent: "unknown", confidence: 0, parameters: {} };

  // Route to the appropriate parser based on the active section
  switch (section) {
    case "subscription":
      parsed = parseSubscriptionCommand(message);
      break;
    case "shipping":
      parsed = parseShippingCommand(message);
      break;
    case "reviews":
      parsed = parseReviewCommand(message);
      break;
    case "migration":
      parsed = parseMigrationCommand(message);
      break;
    default:
      parsed = { intent: "unknown", confidence: 0, parameters: {} };
  }

  return parsed;
}
