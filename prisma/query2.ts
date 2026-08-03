import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const reviews = await prisma.productReview.findMany();
  console.log(reviews);
}
main().finally(() => prisma.$disconnect());
