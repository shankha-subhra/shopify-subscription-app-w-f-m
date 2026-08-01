import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createAdminRestApiClient } from '@shopify/admin-api-client';

const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shop.findFirst();
  if (!shop || !shop.accessToken) {
    console.error("No shop found with token");
    return;
  }

  const client = createAdminRestApiClient({
    storeDomain: shop.shopDomain,
    apiVersion: '2024-07',
    accessToken: shop.accessToken,
  });

  const sellingPlanGroups = await prisma.sellingPlanGroup.findMany({
    take: 50,
  });

  const groupIds = sellingPlanGroups.map(g => g.shopifySellingPlanGroupId);

  const response = await client.graphql(
    `query getDiscounts($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on SellingPlanGroup {
          id
          sellingPlans(first: 1) {
            edges {
              node {
                pricingPolicies {
                  ... on SellingPlanFixedPricingPolicy {
                    adjustmentValue {
                      ... on SellingPlanPricingPolicyPercentageValue {
                        percentage
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`,
    { variables: { ids: groupIds } }
  );

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
