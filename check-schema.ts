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

  const response = await client.graphql(
    `query {
      __type(name: "Mutation") {
        fields {
          name
        }
      }
    }`
  );
  
  const data = await response.json();
  const fields = data.data.__type.fields.map((f: any) => f.name);
  console.log("sellingPlanUpdate exists?", fields.includes("sellingPlanUpdate"));
  console.log("sellingPlanGroupUpdate exists?", fields.includes("sellingPlanGroupUpdate"));
}
main().catch(console.error);
