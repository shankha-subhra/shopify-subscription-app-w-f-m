import { useState } from "react";
import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation, useSubmit } from "@remix-run/react";
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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const planName = formData.get("planName");
  const frequency = formData.get("frequency");
  const discount = formData.get("discount");
  const productIds = formData.get("productIds");
  const status = formData.get("status") || "ACTIVE";

  // Basic validation
  if (!planName || !frequency || !productIds) {
    return json({ error: "Please fill out all required fields and select at least one product." }, { status: 400 });
  }

  // Call Shopify GraphQL to create the Selling Plan Group
  const input = {
    name: planName as string,
    merchantCode: planName as string,
    options: ["Delivery frequency"],
    sellingPlansToCreate: [
      {
        name: `${frequency} Delivery`,
        category: "SUBSCRIPTION",
        options: [frequency === "WEEKLY" ? "1 Week" : frequency === "FORTNIGHTLY" ? "2 Weeks" : "1 Month"],
        billingPolicy: {
          recurring: {
            interval: frequency === "WEEKLY" ? "WEEK" : frequency === "FORTNIGHTLY" ? "WEEK" : "MONTH",
            intervalCount: frequency === "FORTNIGHTLY" ? 2 : 1
          }
        },
        deliveryPolicy: {
          recurring: {
            interval: frequency === "WEEKLY" ? "WEEK" : frequency === "FORTNIGHTLY" ? "WEEK" : "MONTH",
            intervalCount: frequency === "FORTNIGHTLY" ? 2 : 1
          }
        },
        pricingPolicies: [
          {
            fixed: {
              adjustmentType: "PERCENTAGE",
              adjustmentValue: {
                percentage: parseFloat((discount as string) || "0")
              }
            }
          }
        ]
      }
    ]
  };

  const resources = {
    productIds: status === "ACTIVE" ? (productIds as string).split(",") : []
  };

  const response = await admin.graphql(
    `#graphql
    mutation sellingPlanGroupCreate($input: SellingPlanGroupInput!, $resources: SellingPlanGroupResourceInput) {
      sellingPlanGroupCreate(input: $input, resources: $resources) {
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
    {
      variables: { input, resources }
    }
  );

  const responseJson = await response.json();
  const errors = responseJson.data?.sellingPlanGroupCreate?.userErrors;

  if (errors && errors.length > 0) {
    return json({ error: errors[0].message }, { status: 400 });
  }

  const shopifySellingPlanGroupId = responseJson.data.sellingPlanGroupCreate.sellingPlanGroup.id;
  const shopifySellingPlanId = responseJson.data.sellingPlanGroupCreate.sellingPlanGroup.sellingPlans.edges[0].node.id;

  // Save to Database
  const { default: prisma } = await import("../db.server");
  
  // Find or create shop
  let dbShop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!dbShop) {
    dbShop = await prisma.shop.create({
      data: {
        shopDomain: session.shop,
        installationStatus: "installed"
      }
    });
  }

  const rule = await prisma.subscriptionRule.create({
    data: {
      shopId: dbShop.id,
      ruleName: planName as string,
      shopifySellingPlanGroupId,
    }
  });

  const group = await prisma.sellingPlanGroup.create({
    data: {
      shopId: dbShop.id,
      subscriptionRuleId: rule.id,
      shopifySellingPlanGroupId,
      groupName: planName as string,
      merchantCode: planName as string,
      status: status as string
    }
  });

  const frequencyType = frequency === "WEEKLY" ? "WEEKLY" : frequency === "FORTNIGHTLY" ? "FORTNIGHTLY" : "MONTHLY";
  const interval = frequency === "WEEKLY" ? "WEEK" : frequency === "FORTNIGHTLY" ? "WEEK" : "MONTH";
  const intervalCount = frequency === "FORTNIGHTLY" ? 2 : 1;
  const discountVal = parseFloat((discount as string) || "0");

  const freq = await prisma.subscriptionRuleFrequency.create({
    data: {
      subscriptionRuleId: rule.id,
      frequency: frequencyType,
      shopifyInterval: interval,
      intervalCount: intervalCount,
      discountType: "PERCENTAGE",
      discountValue: discountVal,
      shopifySellingPlanId: shopifySellingPlanId
    }
  });

  await prisma.sellingPlan.create({
    data: {
      sellingPlanGroupId: group.id,
      subscriptionRuleFrequencyId: freq.id,
      shopifySellingPlanId: shopifySellingPlanId,
      planName: `${frequency} Delivery`,
      frequency: frequencyType,
      interval: interval,
      intervalCount: intervalCount,
      discountType: "PERCENTAGE",
      discountValue: discountVal,
      status: status as string
    }
  });

  // Save selected products to Prisma if INACTIVE (since they aren't in Shopify yet)
  // or if ACTIVE we still can save them to Prisma, but we only strictly NEED them in Prisma when inactive.
  // We can just save them to Prisma anyway to be safe, or just when INACTIVE.
  if (status === "INACTIVE") {
    const productsJson = formData.get("productsJson") as string;
    if (productsJson) {
      const fullProducts = JSON.parse(productsJson);
      for (const p of fullProducts) {
        await prisma.subscriptionRuleProduct.create({
          data: {
            subscriptionRuleId: rule.id,
            shopifyProductId: p.id,
            productTitle: p.title,
            productHandle: p.handle || "",
            productImageUrl: p.featuredImage?.url || p.images?.[0]?.originalSrc || ""
          }
        });
      }
    }
  }

  // For now, simulate a successful creation and redirect back to the dashboard
  return redirect("/app?success=plan_created");
};

export default function NewPlan() {
  const [planName, setPlanName] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [discount, setDiscount] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";

  const handleSelectProducts = async () => {
    // Uses the global shopify object injected by App Bridge v4
    const selection = await shopify.resourcePicker({ type: "product", multiple: true });
    if (selection) {
      setSelectedProducts(selection);
    }
  };

  const handleSubmit = () => {
    const productIds = selectedProducts.map(p => p.id).join(",");
    const productsJson = JSON.stringify(selectedProducts);
    submit(
      { planName, frequency, discount, status, productIds, productsJson },
      { method: "POST" }
    );
  };

  return (
    <Page
      backAction={{ content: "Dashboard", url: "/app" }}
      title="Create Subscription Plan"
      primaryAction={{
        content: "Save Plan",
        loading: isSubmitting,
        onAction: handleSubmit,
      }}
    >
      <BlockStack gap="500">
        {actionData?.error && (
          <Banner title="Error" tone="critical">
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
                    placeholder="e.g. Subscribe and Save 10%"
                    requiredIndicator
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
                      <Select
                        label="Status"
                        options={[
                          { label: "Active", value: "ACTIVE" },
                          { label: "Inactive", value: "INACTIVE" },
                        ]}
                        value={status}
                        onChange={setStatus}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Discount (%)"
                        type="number"
                        value={discount}
                        onChange={setDiscount}
                        autoComplete="off"
                        placeholder="e.g. 10"
                        suffix="%"
                      />
                    </div>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Included Products</Text>
                    <Button onClick={handleSelectProducts}>Browse Products</Button>
                  </InlineStack>

                  {selectedProducts.length === 0 ? (
                    <Text as="p" tone="subdued">
                      No products selected yet. Click 'Browse Products' to add items to this subscription plan.
                    </Text>
                  ) : (
                    <BlockStack gap="200">
                      {selectedProducts.map((product) => (
                        <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid #e1e3e5' }}>
                          <InlineStack gap="300" blockAlign="center">
                            {product.images?.[0]?.originalSrc && (
                              <img src={product.images[0].originalSrc} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                            )}
                            <Text as="span" variant="bodyMd" fontWeight="semibold">{product.title}</Text>
                          </InlineStack>
                          <Badge tone="success">Active</Badge>
                        </div>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
