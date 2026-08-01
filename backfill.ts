import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.sellingPlanGroup.findMany({
    include: { sellingPlans: true }
  });
  
  for (const group of groups) {
    if (group.sellingPlans.length === 0) {
      console.log(`Fixing plan: ${group.groupName}`);
      
      const freq = await prisma.subscriptionRuleFrequency.create({
        data: {
          subscriptionRuleId: group.subscriptionRuleId,
          frequency: group.groupName === 'Weekly' ? 'WEEKLY' : 'MONTHLY',
          shopifyInterval: group.groupName === 'Weekly' ? 'WEEK' : 'MONTH',
          intervalCount: 1,
          discountType: "PERCENTAGE",
          discountValue: 15.5,
          shopifySellingPlanId: `gid://shopify/SellingPlan/dummy-${group.id}`
        }
      });
      
      await prisma.sellingPlan.create({
        data: {
          sellingPlanGroupId: group.id,
          subscriptionRuleFrequencyId: freq.id,
          shopifySellingPlanId: `gid://shopify/SellingPlan/dummy-${group.id}`,
          planName: `${group.groupName} Delivery`,
          frequency: group.groupName === 'Weekly' ? 'WEEKLY' : 'MONTHLY',
          interval: group.groupName === 'Weekly' ? 'WEEK' : 'MONTH',
          intervalCount: 1,
          discountType: "PERCENTAGE",
          discountValue: 15.5,
          status: "ACTIVE"
        }
      });
    }
  }
  console.log("Done backfilling!");
}

main().catch(console.error);
