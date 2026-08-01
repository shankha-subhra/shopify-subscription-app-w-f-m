import { PrismaClient } from '@prisma/client';
import { createAdminRestApiClient } from '@shopify/admin-api-client';

const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shop.findFirst();
  if (!shop) return;
  
  const client = createAdminRestApiClient({
    storeDomain: shop.shopDomain,
    apiVersion: '2024-07',
    accessToken: shop.accessToken || '',
  });

  const groups = await prisma.sellingPlanGroup.findMany();
  for (const group of groups) {
    console.log("Deleting group:", group.shopifySellingPlanGroupId);
    try {
      await client.graphql(
        `mutation sellingPlanGroupDelete($id: ID!) {
          sellingPlanGroupDelete(id: $id) {
            deletedSellingPlanGroupId
          }
        }`,
        { variables: { id: group.shopifySellingPlanGroupId } }
      );
    } catch (e) {
      console.error("Failed to delete on Shopify", e);
    }
  }

  await prisma.sellingPlanGroup.deleteMany();
  await prisma.subscriptionRule.deleteMany();
  
  console.log("Cleaned up broken plans!");
}

main().catch(console.error);
