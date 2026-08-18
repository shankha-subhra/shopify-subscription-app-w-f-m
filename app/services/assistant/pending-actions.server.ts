import db from "../../db.server";

export interface PendingActionPayload {
  intent: string;
  data: any;
}

export async function createPendingAction(shop: string, conversationId: string | null, moduleName: string, action: string, payload: any) {
  return db.assistantPendingAction.create({
    data: {
      shop,
      conversationId: conversationId || undefined,
      module: moduleName,
      action,
      payload,
      status: "PENDING",
    },
  });
}

export async function getPendingAction(id: string, shop: string) {
  return db.assistantPendingAction.findFirst({
    where: {
      id,
      shop,
      status: "PENDING",
    },
  });
}

export async function confirmPendingAction(id: string, shop: string) {
  return db.assistantPendingAction.update({
    where: { id },
    data: {
      status: "EXECUTED",
      executedAt: new Date(),
    },
  });
}

export async function cancelPendingAction(id: string, shop: string) {
  return db.assistantPendingAction.update({
    where: { id },
    data: {
      status: "CANCELLED",
    },
  });
}

export async function resetAllPendingActions(shop: string) {
  return db.assistantPendingAction.updateMany({
    where: { shop, status: "AWAITING_INPUT" },
    data: { status: "CANCELLED" }
  });
}
