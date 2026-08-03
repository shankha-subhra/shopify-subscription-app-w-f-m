import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Button,
  Checkbox,
  FormLayout,
  Text,
} from "@shopify/polaris";
import { type LoaderFunctionArgs, json, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  let settings = await prisma.reviewSetting.findUnique({
    where: { shop: session.shop }
  });

  if (!settings) {
    settings = await prisma.reviewSetting.create({
      data: { shop: session.shop }
    });
  }

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  await prisma.reviewSetting.update({
    where: { shop: session.shop },
    data: {
      isEnabled: formData.get("isEnabled") === "true",
      allowGuestReviews: formData.get("allowGuestReviews") === "true",
      guestPhoneRequired: formData.get("guestPhoneRequired") === "true",
      verifiedPurchasesOnly: formData.get("verifiedPurchasesOnly") === "true",
      moderationEnabled: formData.get("moderationEnabled") === "true",
      autoApprove: formData.get("autoApprove") === "true",
      allowMultipleImages: formData.get("allowMultipleImages") === "true",
      maxImages: parseInt(formData.get("maxImages") as string, 10) || 5,
      maxImageSizeMb: parseInt(formData.get("maxImageSizeMb") as string, 10) || 5,
      reviewsPerPage: parseInt(formData.get("reviewsPerPage") as string, 10) || 9,
      showVerifiedBadge: formData.get("showVerifiedBadge") === "true",
      showRatingDistribution: formData.get("showRatingDistribution") === "true",
    }
  });

  return json({ success: true, message: "Settings saved successfully!" });
};

export default function ReviewSettings() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const nav = useNavigation();
  const isSaving = nav.state === "submitting";

  const [formState, setFormState] = useState(settings);

  useEffect(() => {
    if (actionData?.success) {
      shopify.toast.show(actionData.message || "Settings saved successfully!");
    } else if (actionData?.success === false) {
      shopify.toast.show("Error saving settings.", { isError: true });
    }
  }, [actionData]);

  const handleChange = (field: string) => (value: string | boolean) => {
    setFormState({ ...formState, [field]: value });
  };

  const handleSave = () => {
    const data = new FormData();
    Object.entries(formState).forEach(([key, value]) => {
      data.append(key, value.toString());
    });
    submit(data, { method: "POST" });
  };

  return (
    <Page 
      title="Review Settings" 
      subtitle="Configure how the Customer Reviews module behaves on your storefront."
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isSaving
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">General Settings</Text>
              <FormLayout>
                <Checkbox
                  label="Enable Customer Reviews module"
                  checked={formState.isEnabled}
                  onChange={handleChange("isEnabled")}
                />
                <Checkbox
                  label="Enable Moderation (Reviews must be approved manually)"
                  checked={formState.moderationEnabled}
                  onChange={handleChange("moderationEnabled")}
                />
                <Checkbox
                  label="Auto-Approve 5-Star Reviews"
                  checked={formState.autoApprove}
                  onChange={handleChange("autoApprove")}
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Customer Rules</Text>
              <FormLayout>
                <Checkbox
                  label="Allow Guest Reviews (Customers not logged in)"
                  checked={formState.allowGuestReviews}
                  onChange={handleChange("allowGuestReviews")}
                />
                <Checkbox
                  label="Require phone number for Guest Reviews"
                  checked={formState.guestPhoneRequired}
                  onChange={handleChange("guestPhoneRequired")}
                />
                <Checkbox
                  label="Only allow verified purchasers to review"
                  checked={formState.verifiedPurchasesOnly}
                  onChange={handleChange("verifiedPurchasesOnly")}
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Image Uploads</Text>
              <FormLayout>
                <Checkbox
                  label="Allow Multiple Image Uploads"
                  checked={formState.allowMultipleImages}
                  onChange={handleChange("allowMultipleImages")}
                />
                <FormLayout.Group>
                  <TextField
                    label="Max Images Allowed"
                    type="number"
                    value={formState.maxImages.toString()}
                    onChange={handleChange("maxImages")}
                    autoComplete="off"
                  />
                  <TextField
                    label="Max Image Size (MB)"
                    type="number"
                    value={formState.maxImageSizeMb.toString()}
                    onChange={handleChange("maxImageSizeMb")}
                    autoComplete="off"
                  />
                </FormLayout.Group>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

      </Layout>
    </Page>
  );
}
