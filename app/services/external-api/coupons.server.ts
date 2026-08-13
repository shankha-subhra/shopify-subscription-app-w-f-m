import db from "../../db.server";
import { logCreation } from "../migration/logger.server";

export async function fetchExternalCoupons(shop: string) {
  const settings = await db.externalSyncSetting.findUnique({ where: { shop } });
  const apiUrl = settings?.apiUrl || "https://fakestoreapi.noksha.dev/api";
  const url = `${apiUrl}/coupons`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch coupons from FakeStore");
  }
  
  const rawData = await response.json();
  const data = Array.isArray(rawData) ? rawData : (rawData.data || rawData.coupons || []);
  
  const limit = settings?.limitCoupons || 0;
  const result = (limit > 0 && Array.isArray(data)) ? data.slice(0, limit) : data;
  
  logCreation('external', 'fetch-coupons', url, null, result);
  return result;
}
