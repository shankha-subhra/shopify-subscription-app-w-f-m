import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.sellingPlanGroup.findMany({
    include: { sellingPlans: true }
  });
  console.log(JSON.stringify(groups, null, 2));
}

main().catch(console.error);
