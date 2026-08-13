import db from "../../db.server";
import { logCreation } from "../migration/logger.server";

export async function fetchExternalCustomers(shop: string) {
  const settings = await db.externalSyncSetting.findUnique({ where: { shop } });
  const apiUrl = settings?.apiUrl || "https://fakestoreapi.noksha.dev/api";
  const url = `${apiUrl}/users`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch users from FakeStore");
  }
  
  const rawData = await response.json();
  const data = Array.isArray(rawData) ? rawData : (rawData.data || rawData.users || []);
  
  const limit = settings?.limitCustomers || 0;
  const result = (limit > 0 && Array.isArray(data)) ? data.slice(0, limit) : data;
  
  logCreation('external', 'fetch-customers', url, null, result);
  return result;
}
