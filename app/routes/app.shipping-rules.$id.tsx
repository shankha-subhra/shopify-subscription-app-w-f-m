import { Page, Layout, Card, FormLayout, TextField, Button, Select } from "@shopify/polaris";
import { useSubmit, useNavigation, Form, useLoaderData } from "@remix-run/react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { useState } from "react";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const rule = await prisma.shippingRule.findUnique({
    where: { id: Number(params.id), shop: session.shop },
  });
  if (!rule) throw new Response("Not Found", { status: 404 });
  return json({ rule });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const response = await admin.graphql(
    `#graphql
      query getShopCurrency {
        shop {
          currencyCode
        }
      }
    `
  );
  const shopData = await response.json();
  const storeCurrency = shopData?.data?.shop?.currencyCode || "USD";

  if (request.method === "DELETE") {
    await prisma.shippingRule.delete({
      where: { id: Number(params.id), shop: session.shop },
    });
    return redirect("/app/shipping-rules");
  }

  await prisma.shippingRule.update({
    where: { id: Number(params.id), shop: session.shop },
    data: {
      ruleName: String(formData.get("ruleName")),
      countryCode: formData.get("countryCode") ? String(formData.get("countryCode")) : null,
      stateCode: formData.get("stateCode") ? String(formData.get("stateCode")) : null,
      city: formData.get("city") ? String(formData.get("city")) : null,
      postalCode: formData.get("postalCode") ? String(formData.get("postalCode")) : null,
      shippingMethodName: String(formData.get("shippingMethodName")),
      shippingPrice: Number(formData.get("shippingPrice") || 0),
      currency: storeCurrency,
      priority: Number(formData.get("priority") || 0),
      isFreeShipping: formData.get("shippingPrice") === "0",
      isActive: formData.get("isActive") !== "false",
    },
  });

  return redirect("/app/shipping-rules");
}

export default function EditShippingRule() {
  const { rule } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const nav = useNavigation();
  const isSaving = nav.state === "submitting";

  const [formState, setFormState] = useState({
    ruleName: rule.ruleName,
    countryCode: rule.countryCode || "",
    stateCode: rule.stateCode || "",
    city: rule.city || "",
    postalCode: rule.postalCode || "",
    shippingMethodName: rule.shippingMethodName,
    shippingPrice: rule.shippingPrice.toString(),
    priority: rule.priority.toString(),
    isActive: rule.isActive ? "true" : "false",
  });

  const handleChange = (value: string, id: string) => {
    setFormState((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (event: any) => {
    event.preventDefault();
    submit(formState, { method: "post" });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this rule?")) {
      submit(null, { method: "delete" });
    }
  };

  return (
    <Page 
      title={`Edit: ${rule.ruleName}`} 
      backAction={{ content: "Rules", url: "/app/shipping-rules" }}
      secondaryActions={[{ content: "Delete rule", destructive: true, onAction: handleDelete }]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Form onSubmit={handleSubmit} method="post">
              <FormLayout>
                <TextField label="Rule Name" name="ruleName" value={formState.ruleName} onChange={(v) => handleChange(v, "ruleName")} autoComplete="off" requiredIndicator />
                <TextField label="Country Code" name="countryCode" value={formState.countryCode} onChange={(v) => handleChange(v, "countryCode")} autoComplete="off" placeholder="e.g. US, CA, IN" />
                <TextField label="State/Province Code" name="stateCode" value={formState.stateCode} onChange={(v) => handleChange(v, "stateCode")} autoComplete="off" placeholder="e.g. NY, ON, WB" />
                <TextField label="City" name="city" value={formState.city} onChange={(v) => handleChange(v, "city")} autoComplete="off" />
                <TextField label="Postal Code" name="postalCode" value={formState.postalCode} onChange={(v) => handleChange(v, "postalCode")} autoComplete="off" />
                <TextField label="Shipping Method Name" name="shippingMethodName" value={formState.shippingMethodName} onChange={(v) => handleChange(v, "shippingMethodName")} autoComplete="off" requiredIndicator />
                <TextField label="Shipping Price" name="shippingPrice" type="number" value={formState.shippingPrice} onChange={(v) => handleChange(v, "shippingPrice")} autoComplete="off" requiredIndicator />
                <TextField label="Priority" name="priority" type="number" value={formState.priority} onChange={(v) => handleChange(v, "priority")} autoComplete="off" />
                
                <Select
                  label="Status"
                  name="isActive"
                  options={[
                    { label: "Active", value: "true" },
                    { label: "Inactive", value: "false" }
                  ]}
                  value={formState.isActive}
                  onChange={(v) => handleChange(v, "isActive")}
                />

                <Button submit variant="primary" loading={isSaving}>
                  Save Rule
                </Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
