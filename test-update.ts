import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const plan = await prisma.sellingPlanGroup.findFirst({
    include: { sellingPlans: true }
  });
  if (!plan) return;
  console.log("Found plan:", plan.id, plan.shopifySellingPlanGroupId);
  console.log("Selling plan id:", plan.sellingPlans[0].shopifySellingPlanId);
}
main();
