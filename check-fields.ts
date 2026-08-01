import { PrismaClient } from '@prisma/client';
import { createAdminRestApiClient } from '@shopify/admin-api-client';

const prisma = new PrismaClient();

async function main() {
  const session = await prisma.session.findFirst({
    where: { shop: { contains: "app-testing-subscription.myshopify.com" } }
  });

  const client = createAdminRestApiClient({
    storeDomain: session!.shop,
    apiVersion: '2024-07',
    accessToken: session!.accessToken || '',
  });

  const response = await client.graphql(
    `query {
      __type(name: "SellingPlanGroupInput") {
        inputFields {
          name
          type { name kind }
        }
      }
    }`
  );
  
  const data = await response.json();
  console.log("SellingPlanGroupInput fields:", JSON.stringify(data.data.__type.inputFields.map((f:any)=>f.name)));
}
main().catch(console.error);
