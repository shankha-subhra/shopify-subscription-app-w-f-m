import { useState, useEffect } from "react";
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigation, useSubmit, useNavigate, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Select,
  Button,
  InlineStack,
  Text,
  Badge,
  Banner,
  Modal,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const planId = parseInt(params.id as string, 10);

  const dbShop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
  });

  if (!dbShop || isNaN(planId)) {
    throw new Response("Not Found", { status: 404 });
  }

  const plan = await prisma.sellingPlanGroup.findFirst({
    where: { id: planId, shopId: dbShop.id },
    include: { sellingPlans: true },
  });

  if (!plan) {
    throw new Response("Not Found", { status: 404 });
  }

  let shopifyPlan = null;

  try {
    const response = await admin.graphql(
      `#graphql
      query getSellingPlanGroup($id: ID!) {
        sellingPlanGroup(id: $id) {
          id
          name
          sellingPlans(first: 1) {
            edges {
              node {
                id
                pricingPolicies {
                  ... on SellingPlanFixedPricingPolicy {
                    adjustmentType
                    adjustmentValue {
                      ... on SellingPlanPricingPolicyPercentageValue {
                        percentage
                      }
                    }
                  }
                }
                billingPolicy {
                  ... on SellingPlanRecurringBillingPolicy {
                    interval
                    intervalCount
                  }
                }
              }
            }
          }
          products(first: 50) {
            edges {
              node {
                id
                title
                featuredImage {
                  url
                }
              }
            }
          }
        }
      }`,
      { variables: { id: plan.shopifySellingPlanGroupId } }
    );
    const responseJson = await response.json();
    if (responseJson.errors) {
      console.error("GraphQL Errors:", responseJson.errors);
    }
    shopifyPlan = responseJson.data?.sellingPlanGroup;
  } catch (error) {
    console.error("Failed to fetch Shopify plan data:", error);
  }

  return json({ plan, shopifyPlan });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const planId = parseInt(params.id as string, 10);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const dbShop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
  });

  const plan = await prisma.sellingPlanGroup.findFirst({
    where: { id: planId, shopId: dbShop?.id },
  });

  if (!plan || !dbShop) return json({ error: "Plan not found" }, { status: 404 });

  if (intent === "toggle_status") {
    const currentPlan = await prisma.sellingPlanGroup.findUnique({ 
      where: { id: Number(params.id) },
      include: { rule: true }
    });
    
    if (currentPlan) {
      const isDeactivating = currentPlan.status === "ACTIVE";
      const newStatus = isDeactivating ? "INACTIVE" : "ACTIVE";

      if (isDeactivating) {
        // 1. Fetch current attached products from Shopify
        const response = await admin.graphql(
          `#graphql
          query getGroupProducts($id: ID!) {
            sellingPlanGroup(id: $id) {
              products(first: 50) {
                edges {
                  node {
                    id
                    title
                    handle
                    featuredImage { url }
                  }
                }
              }
            }
          }`,
          { variables: { id: currentPlan.shopifySellingPlanGroupId } }
        );
        const jsonRes = await response.json();
        const products = jsonRes.data?.sellingPlanGroup?.products?.edges || [];
        
        // 2. Back them up to Prisma so we can restore them later
        await prisma.subscriptionRuleProduct.deleteMany({ where: { subscriptionRuleId: currentPlan.subscriptionRuleId } });
        
        for (const p of products) {
           await prisma.subscriptionRuleProduct.create({
             data: {
               subscriptionRuleId: currentPlan.subscriptionRuleId,
               shopifyProductId: p.node.id,
               productTitle: p.node.title,
               productHandle: p.node.handle,
               productImageUrl: p.node.featuredImage?.url
             }
           });
        }

        // 3. Completely remove them from Shopify so it disappears from the storefront and admin
        const productIds = products.map((p: any) => p.node.id);
        if (productIds.length > 0) {
           await admin.graphql(
             `#graphql
             mutation sellingPlanGroupRemoveProducts($id: ID!, $productIds: [ID!]!) {
               sellingPlanGroupRemoveProducts(id: $id, productIds: $productIds) {
                 userErrors { message }
               }
             }`,
             { variables: { id: currentPlan.shopifySellingPlanGroupId, productIds } }
           );
        }
      } else {
        // ACTIVATING
        // 1. Fetch backed up products from Prisma
        const backedUp = await prisma.subscriptionRuleProduct.findMany({ 
          where: { subscriptionRuleId: currentPlan.subscriptionRuleId } 
        });
        const productIds = backedUp.map(b => b.shopifyProductId);
        
        // 2. Add them all back to Shopify so they reappear!
        if (productIds.length > 0) {
           await admin.graphql(
             `#graphql
             mutation sellingPlanGroupAddProducts($id: ID!, $productIds: [ID!]!) {
               sellingPlanGroupAddProducts(id: $id, productIds: $productIds) {
                 userErrors { message }
               }
             }`,
             { variables: { id: currentPlan.shopifySellingPlanGroupId, productIds } }
           );
        }
      }

      await prisma.sellingPlanGroup.update({
        where: { id: Number(params.id) },
        data: { status: newStatus }
      });
      return redirect("/app?success=status_updated");
    }
    return redirect("/app");
  }

  if (intent === "edit") {
    const planName = formData.get("planName") as string;
    const frequency = formData.get("frequency") as string;
    const discount = formData.get("discount") as string;
    const submittedProductIds = (formData.get("productIds") as string || "").split(",").filter(Boolean);
    const existingProductIds = (formData.get("existingProductIds") as string || "").split(",").filter(Boolean);
    
    const discountVal = parseFloat(discount || "0");
    const interval = frequency === "WEEKLY" ? "WEEK" : frequency === "FORTNIGHTLY" ? "WEEK" : "MONTH";
    const intervalCount = frequency === "FORTNIGHTLY" ? 2 : 1;
    
    // 1. Update Group Details & Selling Plans
    const input: any = {
      name: planName,
      merchantCode: planName,
    };

    if (plan.sellingPlans && plan.sellingPlans.length > 0) {
      input.sellingPlansToUpdate = [
        {
          id: plan.sellingPlans[0].shopifySellingPlanId,
          name: `${frequency} Delivery`,
          billingPolicy: {
            recurring: { interval, intervalCount }
          },
          deliveryPolicy: {
            recurring: { interval, intervalCount }
          },
          pricingPolicies: [
            {
              fixed: {
                adjustmentType: "PERCENTAGE",
                adjustmentValue: { percentage: discountVal }
              }
            }
          ]
        }
      ];
    }

    const updateResponse = await admin.graphql(
      `#graphql
      mutation sellingPlanGroupUpdate($id: ID!, $input: SellingPlanGroupInput!) {
        sellingPlanGroupUpdate(id: $id, input: $input) {
          sellingPlanGroup { id }
          userErrors { message }
        }
      }`,
      { variables: { id: plan.shopifySellingPlanGroupId, input } }
    );
    
    const updateJson = await updateResponse.json();
    if (updateJson.data?.sellingPlanGroupUpdate?.userErrors?.length > 0) {
      return json({ error: updateJson.data.sellingPlanGroupUpdate.userErrors[0].message }, { status: 400 });
    }

    // 2. Add New Products
    const productsToAdd = submittedProductIds.filter(id => !existingProductIds.includes(id));
    if (productsToAdd.length > 0) {
      await admin.graphql(
        `#graphql
        mutation sellingPlanGroupAddProducts($id: ID!, $productIds: [ID!]!) {
          sellingPlanGroupAddProducts(id: $id, productIds: $productIds) {
            userErrors { message }
          }
        }`,
        { variables: { id: plan.shopifySellingPlanGroupId, productIds: productsToAdd } }
      );
    }

    // 3. Remove Deselected Products
    const productsToRemove = existingProductIds.filter(id => !submittedProductIds.includes(id));
    if (productsToRemove.length > 0) {
      await admin.graphql(
        `#graphql
        mutation sellingPlanGroupRemoveProducts($id: ID!, $productIds: [ID!]!) {
          sellingPlanGroupRemoveProducts(id: $id, productIds: $productIds) {
            userErrors { message }
          }
        }`,
        { variables: { id: plan.shopifySellingPlanGroupId, productIds: productsToRemove } }
      );
    }

    // 4. Update Prisma (Discount & Frequency)
    if (plan.sellingPlans && plan.sellingPlans.length > 0) {
      const sellingPlan = plan.sellingPlans[0];
      
      // Update Prisma
      await prisma.sellingPlan.update({
        where: { id: sellingPlan.id },
        data: {
          frequency: frequency === "WEEKLY" ? "WEEKLY" : frequency === "FORTNIGHTLY" ? "FORTNIGHTLY" : "MONTHLY",
          interval,
          intervalCount,
          discountValue: discountVal,
          planName: `${frequency} Delivery`
        }
      });
      
      // Update Prisma Frequency rule
      await prisma.subscriptionRuleFrequency.update({
        where: { id: sellingPlan.subscriptionRuleFrequencyId },
        data: {
          frequency: frequency === "WEEKLY" ? "WEEKLY" : frequency === "FORTNIGHTLY" ? "FORTNIGHTLY" : "MONTHLY",
          shopifyInterval: interval,
          intervalCount,
          discountValue: discountVal
        }
      });
    }

    await prisma.sellingPlanGroup.update({
      where: { id: plan.id },
      data: { groupName: planName, merchantCode: planName }
    });

    return redirect("/app?success=plan_updated");
  }

  return json({ error: "Invalid intent" }, { status: 400 });
};

export default function EditPlan() {
  const { plan, shopifyPlan } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();
  
  // Extract initial values from shopifyPlan
  const initialName = plan.groupName;
  const initialFreq = plan.sellingPlans?.[0]?.frequency || "MONTHLY";
  const initialDiscount = plan.sellingPlans?.[0]?.discountValue?.toString() || "0";

  // Map existing Shopify products to state
  const initialProducts = shopifyPlan?.products?.edges?.map((edge: any) => edge.node) || [];
  const existingProductIds = initialProducts.map((p: any) => p.id).join(",");

  const [planName, setPlanName] = useState(initialName);
  const [frequency, setFrequency] = useState(initialFreq);
  const [discount, setDiscount] = useState(initialDiscount);
  const [selectedProducts, setSelectedProducts] = useState<any[]>(initialProducts);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleSelectProducts = async () => {
    const selectionIds = selectedProducts.map(p => ({ id: p.id }));
    const selection = await shopify.resourcePicker({ 
      type: "product", 
      multiple: true,
      selectionIds
    });
    if (selection) {
      // Just set the selection directly, App Bridge handles the add/remove state from the picker itself
      setSelectedProducts(selection);
    }
  };

  const handleRemoveProduct = (id: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
  };

  const handleUpdate = () => {
    const productIds = selectedProducts.map(p => p.id).join(",");
    submit({ intent: "edit", planName, frequency, discount, productIds, existingProductIds }, { method: "POST" });
  };

  const handleToggleStatus = () => {
    submit({ intent: "toggle_status" }, { method: "POST" });
  };

  return (
    <Page
      backAction={{ content: "Plans", url: "/app/plans" }}
      title={`Edit Plan: ${plan.groupName}`}
    >
      <BlockStack gap="500">
        {actionData?.error && (
          <Banner title="Error Saving Plan" tone="critical">
            {actionData.error}
          </Banner>
        )}
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Plan Details</Text>
                  <TextField
                    label="Plan Name"
                    value={planName}
                    onChange={setPlanName}
                    autoComplete="off"
                  />
                  <InlineStack gap="400">
                    <div style={{ flex: 1 }}>
                      <Select
                        label="Billing Frequency"
                        options={[
                          { label: "Weekly", value: "WEEKLY" },
                          { label: "Fortnightly", value: "FORTNIGHTLY" },
                          { label: "Monthly", value: "MONTHLY" },
                        ]}
                        value={frequency}
                        onChange={setFrequency}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Discount (%)"
                        type="number"
                        value={discount}
                        onChange={setDiscount}
                        autoComplete="off"
                        suffix="%"
                      />
                    </div>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Attached Products</Text>
                    <Button onClick={handleSelectProducts}>Browse Products</Button>
                  </InlineStack>
                  
                  {selectedProducts.length > 0 ? (
                    <BlockStack gap="200">
                      {selectedProducts.map((product: any) => (
                        <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid #e1e3e5' }}>
                          <InlineStack gap="300" blockAlign="center">
                            {product.featuredImage?.url ? (
                              <img src={product.featuredImage.url} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                            ) : product.images?.[0]?.originalSrc ? (
                              <img src={product.images[0].originalSrc} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                            ) : null}
                            <Text as="span" variant="bodyMd" fontWeight="semibold">{product.title}</Text>
                          </InlineStack>
                          <InlineStack gap="300" blockAlign="center">
                            <Badge tone="success">Active</Badge>
                            <Button size="micro" tone="critical" variant="plain" onClick={() => handleRemoveProduct(product.id)}>Remove</Button>
                          </InlineStack>
                        </div>
                      ))}
                    </BlockStack>
                  ) : (
                    <Text as="p" tone="subdued">No products are currently attached to this plan.</Text>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
        
        <InlineStack gap="300" align="end" blockAlign="center">
          <Button tone={plan.status === "ACTIVE" ? "critical" : "success"} onClick={() => setIsDeleteModalOpen(true)}>
            {plan.status === "ACTIVE" ? "Deactivate Plan" : "Activate Plan"}
          </Button>
          <Button variant="primary" onClick={handleUpdate}>
            Save Changes
          </Button>
        </InlineStack>
      </BlockStack>

      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={plan.status === "ACTIVE" ? "Deactivate Subscription Plan?" : "Activate Subscription Plan?"}
        primaryAction={{
          content: plan.status === "ACTIVE" ? "Deactivate" : "Activate",
          destructive: plan.status === "ACTIVE",
          onAction: handleToggleStatus,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsDeleteModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            {plan.status === "ACTIVE" 
              ? "Are you sure you want to deactivate this plan? This will change its status to inactive."
              : "Are you sure you want to activate this plan? This will make it active again."}
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
