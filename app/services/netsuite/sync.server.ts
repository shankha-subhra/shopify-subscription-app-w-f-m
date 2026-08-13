import db from "../../db.server";
import { syncNetSuiteProductToShopify } from "./product.server";

export async function processSyncJob(jobId: number) {
  const job = await db.netSuiteSyncJob.findUnique({ where: { id: jobId }});
  if (!job) return;

  // Coordinate sync execution based on entityType
}
