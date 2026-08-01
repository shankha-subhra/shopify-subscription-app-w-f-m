import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  const shop = await prisma.shop.upsert({
    where: { shopDomain: 'test-shop.myshopify.com' },
    update: {},
    create: {
      shopDomain: 'test-shop.myshopify.com',
      installationStatus: 'installed',
      installationDate: new Date(),
    },
  });

  console.log({ shop });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
