import db from "../../db.server";
import { authenticate } from "../../shopify.server";
import { AdminApiContext } from "@shopify/shopify-app-remix/server";

export async function listSubscriptionRules(shop: string) {
  const shopRecord = await db.shop.findUnique({
    where: { shopDomain: shop },
    include: {
      subscriptionRules: {
        include: {
          products: true,
          frequencies: true,
          sellingPlanGroups: true,
        }
      }
    }
  });

  if (!shopRecord) return [];

  return shopRecord.subscriptionRules.map(rule => {
    const group = rule.sellingPlanGroups[0];
    const status = group?.status || (rule.activeStatus ? "ACTIVE" : "INACTIVE");
    
    return {
      id: rule.id.toString(),
      name: rule.ruleName,
      status: status,
      productCount: rule.products.length,
      productIds: rule.products.map(p => p.shopifyProductId),
      frequencies: rule.frequencies.map(f => `${f.intervalCount} ${f.shopifyInterval}`),
      discount: rule.frequencies[0]?.discountValue 
        ? `${rule.frequencies[0].discountValue}${rule.frequencies[0].discountType === 'PERCENTAGE' ? '%' : ''}` 
        : 'None'
    };
  });
}

export async function createSubscriptionRule(
  shop: string, 
  admin: AdminApiContext, 
  data: { 
    name: string; 
    frequency: string; 
    interval: number; 
    discountType: string; 
    discountValue: number; 
  }
) {
  // Translate from simple assistant schema to shopify logic
  const shopifyInterval = data.frequency === "MONTH" ? "MONTH" : data.frequency === "WEEK" ? "WEEK" : "DAY";
  const intervalCount = data.interval || 1;
  
  const input = {
    name: data.name,
    merchantCode: data.name,
    options: ["Delivery frequency"],
    sellingPlansToCreate: [
      {
        name: `Every ${intervalCount} ${shopifyInterval.toLowerCase()}`,
        category: "SUBSCRIPTION",
        options: [`${intervalCount} ${shopifyInterval}`],
        billingPolicy: {
          recurring: {
            interval: shopifyInterval,
            intervalCount: intervalCount
          }
        },
        deliveryPolicy: {
          recurring: {
            interval: shopifyInterval,
            intervalCount: intervalCount
          }
        },
        pricingPolicies: data.discountValue > 0 ? [
          {
            fixed: {
              adjustmentType: data.discountType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED_AMOUNT",
              adjustmentValue: data.discountType === "PERCENTAGE" 
                ? { percentage: data.discountValue }
                : { amount: data.discountValue }
            }
          }
        ] : []
      }
    ]
  };

  const response = await admin.graphql(
    `#graphql
    mutation sellingPlanGroupCreate($input: SellingPlanGroupInput!) {
      sellingPlanGroupCreate(input: $input) {
        sellingPlanGroup {
          id
          sellingPlans(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    { variables: { input } }
  );

  const responseJson = await response.json();
  const errors = responseJson.data?.sellingPlanGroupCreate?.userErrors;

  if (errors && errors.length > 0) {
    throw new Error(errors[0].message);
  }

  const shopifySellingPlanGroupId = responseJson.data.sellingPlanGroupCreate.sellingPlanGroup.id;
  const shopifySellingPlanId = responseJson.data.sellingPlanGroupCreate.sellingPlanGroup.sellingPlans.edges[0].node.id;

  const dbShop = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!dbShop) throw new Error("Shop not found in db");

  const rule = await db.subscriptionRule.create({
    data: {
      shopId: dbShop.id,
      ruleName: data.name,
      shopifySellingPlanGroupId,
      activeStatus: true,
    }
  });

  const group = await db.sellingPlanGroup.create({
    data: {
      shopId: dbShop.id,
      subscriptionRuleId: rule.id,
      shopifySellingPlanGroupId,
      groupName: data.name,
      merchantCode: data.name,
      status: "ACTIVE"
    }
  });

  const freq = await db.subscriptionRuleFrequency.create({
    data: {
      subscriptionRuleId: rule.id,
      frequency: data.frequency === "MONTH" ? "MONTHLY" : data.frequency === "WEEK" ? "WEEKLY" : "FORTNIGHTLY", // Simplified enum mapping
      shopifyInterval: shopifyInterval,
      intervalCount: intervalCount,
      discountType: data.discountType,
      discountValue: data.discountValue,
      shopifySellingPlanId: shopifySellingPlanId
    }
  });

  await db.sellingPlan.create({
    data: {
      sellingPlanGroupId: group.id,
      subscriptionRuleFrequencyId: freq.id,
      shopifySellingPlanId: shopifySellingPlanId,
      planName: `Every ${intervalCount} ${shopifyInterval.toLowerCase()}`,
      frequency: freq.frequency,
      interval: shopifyInterval,
      intervalCount: intervalCount,
      discountType: data.discountType,
      discountValue: data.discountValue,
      status: "ACTIVE"
    }
  });

  return rule;
}

export async function changeSubscriptionStatus(shop: string, admin: AdminApiContext, ruleId: number, status: "ACTIVE" | "INACTIVE") {
  const rule = await db.subscriptionRule.findFirst({
    where: { id: ruleId, shop: { shopDomain: shop } },
    include: { sellingPlanGroups: true, frequencies: true }
  });

  if (!rule) throw new Error("Rule not found");

  // Update in DB
  await db.subscriptionRule.update({
    where: { id: ruleId },
    data: { activeStatus: status === "ACTIVE" }
  });

  for (const group of rule.sellingPlanGroups) {
    await db.sellingPlanGroup.update({
      where: { id: group.id },
      data: { status }
    });
    
    // In a full implementation, you would also call Shopify API to update the Selling Plan Group if needed.
    // However, Shopify doesn't strictly have an "ACTIVE/INACTIVE" status on the group itself, 
    // it depends on product associations or deleting the group. We simulate status in our DB for now.
  }

  return { success: true, newStatus: status };
}

export async function addProductsToRule(shop: string, admin: AdminApiContext, ruleId: number, productIds: string[]) {
  const rule = await db.subscriptionRule.findFirst({
    where: { id: ruleId, shop: { shopDomain: shop } },
    include: { sellingPlanGroups: true }
  });

  if (!rule || rule.sellingPlanGroups.length === 0) throw new Error("Rule or Selling Plan Group not found");
  const shopifyGroupId = rule.sellingPlanGroups[0].shopifySellingPlanGroupId;

  // 1. Add to Shopify Selling Plan Group
  const response = await admin.graphql(
    `#graphql
    mutation sellingPlanGroupAddProducts($id: ID!, $productIds: [ID!]!) {
      sellingPlanGroupAddProducts(id: $id, productIds: $productIds) {
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        id: shopifyGroupId,
        productIds
      }
    }
  );

  const responseJson = await response.json();
  const errors = responseJson.data?.sellingPlanGroupAddProducts?.userErrors;
  if (errors && errors.length > 0) {
    throw new Error(errors[0].message);
  }

  // 2. Fetch product details from Shopify to store in Prisma
  for (const pid of productIds) {
    // Basic fetch to get title and handle (could be optimized with a bulk query)
    const pResponse = await admin.graphql(
      `#graphql
      query($id: ID!) {
        product(id: $id) {
          title
          handle
          featuredImage { url }
        }
      }`,
      { variables: { id: pid } }
    );
    const pJson = await pResponse.json();
    const productData = pJson.data?.product;

    if (productData) {
      await db.subscriptionRuleProduct.upsert({
        where: {
          subscriptionRuleId_shopifyProductId: {
            subscriptionRuleId: rule.id,
            shopifyProductId: pid
          }
        },
        update: {},
        create: {
          subscriptionRuleId: rule.id,
          shopifyProductId: pid,
          productTitle: productData.title,
          productHandle: productData.handle,
          productImageUrl: productData.featuredImage?.url || ""
        }
      });
    }
  }

  return { success: true, addedCount: productIds.length };
}

export async function removeProductsFromRule(shop: string, admin: AdminApiContext, ruleId: number, productIds: string[]) {
  const rule = await db.subscriptionRule.findFirst({
    where: { id: ruleId, shop: { shopDomain: shop } },
    include: { sellingPlanGroups: true }
  });

  if (!rule || rule.sellingPlanGroups.length === 0) throw new Error("Rule or Selling Plan Group not found");
  const shopifyGroupId = rule.sellingPlanGroups[0].shopifySellingPlanGroupId;

  // 1. Remove from Shopify Selling Plan Group
  const response = await admin.graphql(
    `#graphql
    mutation sellingPlanGroupRemoveProducts($id: ID!, $productIds: [ID!]!) {
      sellingPlanGroupRemoveProducts(id: $id, productIds: $productIds) {
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        id: shopifyGroupId,
        productIds
      }
    }
  );

  // 2. Remove from DB
  await db.subscriptionRuleProduct.deleteMany({
    where: {
      subscriptionRuleId: ruleId,
      shopifyProductId: { in: productIds }
    }
  });

  return { success: true, removedCount: productIds.length };
}

// Optional: replace products
// We would call remove on all existing, then add new.

export async function searchProducts(admin: AdminApiContext, query: string, limit: number = 5) {
  const response = await admin.graphql(
    `#graphql
    query searchProducts($query: String!, $first: Int!) {
      products(first: $first, query: $query) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }`,
    { variables: { query: `title:*${query}* OR sku:*${query}*`, first: limit } }
  );
  
  const json = await response.json();
  if (json.data?.products?.edges) {
    return json.data.products.edges.map((e: any) => ({
      id: e.node.id,
      title: e.node.title,
      handle: e.node.handle
    }));
  }
  return [];
}
