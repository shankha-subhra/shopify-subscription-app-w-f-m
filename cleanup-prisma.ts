import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.sellingPlan.deleteMany();
  await prisma.subscriptionRuleFrequency.deleteMany();
  await prisma.sellingPlanGroup.deleteMany();
  await prisma.subscriptionRule.deleteMany();
  
  console.log("Cleaned up broken plans in Prisma!");
}

main().catch(console.error);
