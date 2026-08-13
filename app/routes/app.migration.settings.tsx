import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, Form } from "@remix-run/react";
import { Card, Text, BlockStack, TextField, Button, InlineStack, Box, ChoiceList, Divider, FormLayout } from "@shopify/polaris";
import { useState, useCallback } from "react";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  let settings = await db.externalSyncSetting.findUnique({
    where: { shop },
  });

  if (!settings) {
    settings = await db.externalSyncSetting.create({
      data: { shop },
    });
  }

  return json({ settings });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const formData = await request.formData();
  const apiUrl = formData.get("apiUrl") as string;
  const apiKey = formData.get("apiKey") as string;
  const migrationMode = formData.get("migrationMode") as string;
  
  await db.externalSyncSetting.update({
    where: { shop },
    data: {
      apiUrl,
      apiKey: apiKey || null,
      migrationMode,
      limitCategories: parseInt(formData.get("limitCategories") as string) || 0,
      limitProducts: parseInt(formData.get("limitProducts") as string) || 0,
      limitCustomers: parseInt(formData.get("limitCustomers") as string) || 0,
      limitOrders: parseInt(formData.get("limitOrders") as string) || 0,
      limitCoupons: parseInt(formData.get("limitCoupons") as string) || 0,
    },
  });

  return json({ success: true });
}

export default function MigrationSettings() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey || "");
  const [migrationMode, setMigrationMode] = useState<string[]>([settings.migrationMode]);
  
  const [limitCategories, setLimitCategories] = useState(settings.limitCategories);
  const [limitProducts, setLimitProducts] = useState(settings.limitProducts);
  const [limitCustomers, setLimitCustomers] = useState(settings.limitCustomers);
  const [limitOrders, setLimitOrders] = useState(settings.limitOrders);
  const [limitCoupons, setLimitCoupons] = useState(settings.limitCoupons);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append("apiUrl", apiUrl);
    formData.append("apiKey", apiKey);
    formData.append("migrationMode", migrationMode[0]);
    formData.append("limitCategories", limitCategories.toString());
    formData.append("limitProducts", limitProducts.toString());
    formData.append("limitCustomers", limitCustomers.toString());
    formData.append("limitOrders", limitOrders.toString());
    formData.append("limitCoupons", limitCoupons.toString());
    
    submit(formData, { method: "post" });
    shopify.toast.show("Settings saved successfully");
  }, [apiUrl, apiKey, migrationMode, limitCategories, limitProducts, limitCustomers, limitOrders, limitCoupons, submit]);

  return (
    <BlockStack gap="500">
      <InlineStack align="space-between">
        <Text variant="headingLg" as="h1">Migration Settings</Text>
        <Button variant="primary" onClick={handleSave}>Save Settings</Button>
      </InlineStack>

      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">API Configuration</Text>
          <TextField
            label="FakeStore API URL"
            value={apiUrl}
            onChange={setApiUrl}
            autoComplete="off"
            helpText="The base URL for all migration endpoints."
          />
          <TextField
            label="API Key (Optional)"
            type="password"
            value={apiKey}
            onChange={setApiKey}
            autoComplete="off"
            helpText="Used if the API requires authorization headers."
          />
        </BlockStack>
      </Card>
      
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Global Sync Settings</Text>
          <ChoiceList
            title="Default Migration Mode"
            choices={[
              {label: 'Import new + update existing (Safe)', value: 'IMPORT_NEW_UPDATE_EXISTING'},
              {label: 'Import new only (Skip existing)', value: 'IMPORT_NEW_ONLY'},
              {label: 'Update existing only (Ignore new)', value: 'UPDATE_EXISTING_ONLY'},
            ]}
            selected={migrationMode}
            onChange={setMigrationMode}
          />
          <Divider />
          <Text variant="headingMd" as="h2">Import Limits (0 = Unlimited)</Text>
          <FormLayout>
            <FormLayout.Group>
              <TextField label="Categories Limit" type="number" value={String(limitCategories)} onChange={(v) => setLimitCategories(Number(v))} autoComplete="off" />
              <TextField label="Products Limit" type="number" value={String(limitProducts)} onChange={(v) => setLimitProducts(Number(v))} autoComplete="off" />
              <TextField label="Customers Limit" type="number" value={String(limitCustomers)} onChange={(v) => setLimitCustomers(Number(v))} autoComplete="off" />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField label="Orders Limit" type="number" value={String(limitOrders)} onChange={(v) => setLimitOrders(Number(v))} autoComplete="off" />
              <TextField label="Coupons Limit" type="number" value={String(limitCoupons)} onChange={(v) => setLimitCoupons(Number(v))} autoComplete="off" />
            </FormLayout.Group>
          </FormLayout>
          
          <Divider />
          <Text variant="headingMd" as="h2">Throttling</Text>
          <TextField
            label="Requests per second"
            type="number"
            value="5"
            onChange={() => {}}
            autoComplete="off"
            helpText="Max concurrency for background job queue API calls."
            disabled
          />
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
