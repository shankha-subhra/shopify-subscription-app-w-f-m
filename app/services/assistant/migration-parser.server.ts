import { containsAny } from "./intent-helpers.server";

export function parseMigrationCommand(message: string): any {
  // 1. Start Migration Intent
  if (containsAny(message, ["import", "migrate", "sync", "start"])) {
    const types: string[] = [];
    if (containsAny(message, ["product", "products"])) types.push("PRODUCTS");
    if (containsAny(message, ["customer", "customers"])) types.push("CUSTOMERS");
    if (containsAny(message, ["order", "orders"])) types.push("ORDERS");
    if (containsAny(message, ["inventory"])) types.push("INVENTORY");

    if (types.length === 0) {
      types.push("ALL"); // fallback
    }

    return {
      intent: "start_migration",
      confidence: 1,
      parameters: { types }
    };
  }

  // 2. Retry Failed Items Intent
  if (containsAny(message, ["retry", "re-import", "re-migrate"]) && containsAny(message, ["fail", "failed", "error"])) {
    return {
      intent: "retry_failed_migration",
      confidence: 1,
      parameters: {}
    };
  }

  // 3. Show Failed Items Intent
  if (containsAny(message, ["show", "list", "view", "what", "which"]) && containsAny(message, ["fail", "failed", "error"])) {
    return {
      intent: "list_failed_migrations",
      confidence: 1,
      parameters: {}
    };
  }

  // 4. Show Migration Status Intent
  if (containsAny(message, ["show", "check", "how many", "status", "progress"])) {
    return {
      intent: "check_migration_status",
      confidence: 1,
      parameters: {}
    };
  }

  return { intent: "unknown", confidence: 0 };
}
