import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const session = await prisma.session.findFirst({
    where: { shop: { contains: "app-testing-subscription.myshopify.com" } }
  });

  if (!session) {
    console.log("No session found!");
    return;
  }

  const shop = session.shop;
  const token = session.accessToken;

  console.log(`Using shop: ${shop}`);

  // Fetch all selling plan groups from Shopify
  const response = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token
    },
    body: JSON.stringify({
      query: `
        query {
          sellingPlanGroups(first: 50) {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      `
    })
  });

  const data = await response.json();
  const groups = data.data?.sellingPlanGroups?.edges || [];
  
  if (groups.length === 0) {
    console.log("No groups found on Shopify.");
    return;
  }

  console.log(`Found ${groups.length} groups on Shopify. Deleting them...`);

  for (const group of groups) {
    const id = group.node.id;
    console.log(`Deleting ${group.node.name} (${id})...`);
    
    const delRes = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      body: JSON.stringify({
        query: `
          mutation sellingPlanGroupDelete($id: ID!) {
            sellingPlanGroupDelete(id: $id) {
              deletedSellingPlanGroupId
              userErrors { message }
            }
          }
        `,
        variables: { id }
      })
    });
    
    const delData = await delRes.json();
    if (delData.data?.sellingPlanGroupDelete?.userErrors?.length > 0) {
      console.error(`Error deleting ${id}:`, delData.data.sellingPlanGroupDelete.userErrors);
    } else {
      console.log(`Deleted successfully.`);
    }
  }
}

main().catch(console.error);
