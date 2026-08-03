import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const reviews = await prisma.productReview.findMany({
    select: { id: true, productId: true, status: true }
  });
  console.log(reviews);
}
main().finally(() => prisma.$disconnect());
