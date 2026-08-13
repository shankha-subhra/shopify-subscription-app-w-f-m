import db from "../../db.server";
import { logCreation } from "../migration/logger.server";

export async function fetchExternalOrders(shop: string) {
  const settings = await db.externalSyncSetting.findUnique({ where: { shop } });
  const apiUrl = settings?.apiUrl || "https://fakestoreapi.noksha.dev/api";
  const url = `${apiUrl}/orders`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch orders from FakeStore");
  }
  
  const rawData = await response.json();
  const data = Array.isArray(rawData) ? rawData : (rawData.data || rawData.orders || []);
  
  const limit = settings?.limitOrders || 0;
  const result = (limit > 0 && Array.isArray(data)) ? data.slice(0, limit) : data;
  
  logCreation('external', 'fetch-orders', url, null, result);
  return result;
}
