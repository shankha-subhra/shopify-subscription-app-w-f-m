import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Text,
} from "@shopify/polaris";
import { useLoaderData, useSubmit, useNavigation, Form, useActionData, useNavigate } from "@remix-run/react";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";
import { updateCarrierServiceUrlIfNeeded } from "../services/carrier-service.server";
import { Banner } from "@shopify/polaris";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  
  // Fetch the store's base currency
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

  let settings = await prisma.shippingSetting.findUnique({
    where: { shop: session.shop },
  });

  if (!settings) {
    settings = await prisma.shippingSetting.create({
      data: { shop: session.shop, currency: storeCurrency },
    });
  } else if (settings.currency !== storeCurrency) {
    settings = await prisma.shippingSetting.update({
      where: { shop: session.shop },
      data: { currency: storeCurrency },
    });
  }

  return json({ settings, storeCurrency });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  try {
    const quantityThreshold = Number(formData.get("quantityThreshold"));
    const belowThresholdPrice = Number(formData.get("belowThresholdPrice"));
    const atOrAboveThresholdPrice = Number(formData.get("atOrAboveThresholdPrice"));

    const updatedSettings = await prisma.shippingSetting.update({
      where: { shop: session.shop },
      data: {
        isEnabled: formData.get("isEnabled") === "true",
        quantityThreshold,
        belowThresholdPrice,
        atOrAboveThresholdPrice,
        belowThresholdMethodName: String(formData.get("belowThresholdMethodName")),
        atOrAboveThresholdMethodName: String(formData.get("atOrAboveThresholdMethodName")),
        fallbackEnabled: formData.get("fallbackEnabled") === "true",
        fallbackPrice: formData.get("fallbackPrice") ? Number(formData.get("fallbackPrice")) : null,
        currency: String(formData.get("currency")),
        loggingEnabled: formData.get("loggingEnabled") === "true",
      },
    });

    // Ensure carrier service is registered and points to the correct URL if enabled
    if (updatedSettings.isEnabled) {
      try {
        const appUrl = process.env.SHOPIFY_APP_URL || "";
        const carrierServiceId = await updateCarrierServiceUrlIfNeeded(admin, appUrl);
        if (carrierServiceId && carrierServiceId !== updatedSettings.carrierServiceId) {
          await prisma.shippingSetting.update({
            where: { shop: session.shop },
            data: { carrierServiceId },
          });
        }
      } catch (error) {
        console.error("Failed to register Carrier Service", error);
        return json({ success: false, error: "Failed to register Carrier Service. Settings saved locally." });
      }
    }

    return json({ success: true, settings: updatedSettings });
  } catch (error: any) {
    return json({ success: false, error: error.message || "Failed to save settings." });
  }
}

export default function ShippingSettings() {
  const { settings, storeCurrency } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const nav = useNavigation();
  const navigate = useNavigate();
  const isSaving = nav.state === "submitting";

  useEffect(() => {
    if (actionData?.success) {
      const timer = setTimeout(() => {
        navigate("/app/shipping-rules");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [actionData, navigate]);

  const [formState, setFormState] = useState({
    quantityThreshold: settings.quantityThreshold.toString(),
    belowThresholdPrice: settings.belowThresholdPrice.toString(),
    belowThresholdMethodName: settings.belowThresholdMethodName,
    atOrAboveThresholdPrice: settings.atOrAboveThresholdPrice.toString(),
    atOrAboveThresholdMethodName: settings.atOrAboveThresholdMethodName,
  });

  const handleChange = (value: string, id: string) => {
    setFormState((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (event: any) => {
    event.preventDefault();
    submit(
      {
        ...formState,
        isEnabled: "true",
        loggingEnabled: "true",
        fallbackEnabled: "false",
        currency: storeCurrency,
      },
      { method: "post" }
    );
  };

  return (
    <Page title="Shipping Settings" backAction={{ content: "Rules", url: "/app/shipping-rules" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {actionData?.success && (
              <Banner tone="success" onDismiss={() => {}}>
                <p>Settings saved successfully.</p>
              </Banner>
            )}
            {actionData?.success === false && (
              <Banner tone="critical" onDismiss={() => {}}>
                <p>{actionData.error}</p>
              </Banner>
            )}
            <Card>
              <Form onSubmit={handleSubmit} method="post">
                <FormLayout>
                  <Text variant="headingMd" as="h2">General Configuration</Text>
                
                <TextField
                  label="Quantity Threshold"
                  name="quantityThreshold"
                  type="number"
                  value={formState.quantityThreshold}
                  onChange={(val) => handleChange(val, "quantityThreshold")}
                  autoComplete="off"
                  helpText="Number of items in cart to trigger bulk shipping rate."
                />
                
                <TextField
                  label="Below Threshold Price"
                  name="belowThresholdPrice"
                  type="number"
                  value={formState.belowThresholdPrice}
                  onChange={(val) => handleChange(val, "belowThresholdPrice")}
                  autoComplete="off"
                />

                <TextField
                  label="Below Threshold Method Name"
                  name="belowThresholdMethodName"
                  value={formState.belowThresholdMethodName}
                  onChange={(val) => handleChange(val, "belowThresholdMethodName")}
                  autoComplete="off"
                />

                <TextField
                  label="At or Above Threshold Price"
                  name="atOrAboveThresholdPrice"
                  type="number"
                  value={formState.atOrAboveThresholdPrice}
                  onChange={(val) => handleChange(val, "atOrAboveThresholdPrice")}
                  autoComplete="off"
                />

                <TextField
                  label="At or Above Threshold Method Name"
                  name="atOrAboveThresholdMethodName"
                  value={formState.atOrAboveThresholdMethodName}
                  onChange={(val) => handleChange(val, "atOrAboveThresholdMethodName")}
                  autoComplete="off"
                />

                <Button submit variant="primary" loading={isSaving}>
                  Save Settings
                </Button>
              </FormLayout>
            </Form>
          </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
