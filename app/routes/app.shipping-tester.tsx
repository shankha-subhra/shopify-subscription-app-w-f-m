import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { useSubmit, useActionData, Form, useNavigation } from "@remix-run/react";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { calculateShippingRate } from "../services/shipping-calculator.server";
import { useState } from "react";

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const cartQuantity = Number(formData.get("cartQuantity"));
  const destination = {
    countryCode: formData.get("countryCode") as string,
    stateCode: formData.get("stateCode") as string,
    city: formData.get("city") as string,
    postalCode: formData.get("postalCode") as string,
  };

  const settings = await prisma.shippingSetting.findUnique({
    where: { shop: session.shop },
  });

  const rules = await prisma.shippingRule.findMany({
    where: { shop: session.shop },
  });

  const rate = calculateShippingRate({ cartQuantity, destination, rules, settings });

  return json({ rate, destination, cartQuantity });
}

export default function ShippingTester() {
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const isTesting = nav.state === "submitting";

  const [formState, setFormState] = useState({
    cartQuantity: "1",
    countryCode: "",
    stateCode: "",
    city: "",
    postalCode: "",
  });

  const handleChange = (value: string, id: string) => {
    setFormState((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (event: any) => {
    event.preventDefault();
    submit(formState, { method: "post" });
  };

  return (
    <Page title="Shipping Rate Tester" backAction={{ content: "Rules", url: "/app/shipping-rules" }}>
      <Layout>
        <Layout.Section variant="oneHalf">
          <Card>
            <Form onSubmit={handleSubmit} method="post">
              <FormLayout>
                <TextField label="Cart Quantity" name="cartQuantity" type="number" value={formState.cartQuantity} onChange={(v) => handleChange(v, "cartQuantity")} autoComplete="off" requiredIndicator />
                <TextField label="Country Code" name="countryCode" value={formState.countryCode} onChange={(v) => handleChange(v, "countryCode")} autoComplete="off" placeholder="e.g. US" />
                <TextField label="State/Province Code" name="stateCode" value={formState.stateCode} onChange={(v) => handleChange(v, "stateCode")} autoComplete="off" placeholder="e.g. NY" />
                <TextField label="City" name="city" value={formState.city} onChange={(v) => handleChange(v, "city")} autoComplete="off" />
                <TextField label="Postal Code" name="postalCode" value={formState.postalCode} onChange={(v) => handleChange(v, "postalCode")} autoComplete="off" />
                
                <Button submit variant="primary" loading={isTesting}>
                  Test Rate
                </Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Test Results</Text>
              {actionData?.rate ? (
                <BlockStack gap="200">
                  <Text as="p"><strong>Service Name:</strong> {actionData.rate.serviceName}</Text>
                  <Text as="p"><strong>Price:</strong> {actionData.rate.price} {actionData.rate.currency}</Text>
                  <Text as="p"><strong>Source:</strong> {actionData.rate.source}</Text>
                  {actionData.rate.matchedRuleName && (
                    <Text as="p"><strong>Matched Rule:</strong> {actionData.rate.matchedRuleName}</Text>
                  )}
                </BlockStack>
              ) : actionData && !actionData.rate ? (
                <Text as="p" tone="subdued">No shipping rate returned. Custom shipping might be disabled.</Text>
              ) : (
                <Text as="p" tone="subdued">Enter destination and cart details to test.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
