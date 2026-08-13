import { Card, Text, BlockStack, InlineStack, Checkbox, Button, Box, Divider, ProgressBar } from "@shopify/polaris";
import { useState } from "react";

export default function NetSuiteMigration() {
  const [syncProducts, setSyncProducts] = useState(true);
  const [syncCategories, setSyncCategories] = useState(true);
  const [syncCustomers, setSyncCustomers] = useState(true);
  const [syncOrders, setSyncOrders] = useState(true);

  const [migrating, setMigrating] = useState(false);

  return (
    <BlockStack gap="500">
      <Text variant="headingLg" as="h1">NetSuite Migration</Text>
      
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Select Data</Text>
          
          <Checkbox label="Products (Variants, Images, Inventory, Prices)" checked={syncProducts} onChange={setSyncProducts} />
          <Checkbox label="Categories / Collections" checked={syncCategories} onChange={setSyncCategories} />
          <Checkbox label="Customers" checked={syncCustomers} onChange={setSyncCustomers} />
          <Checkbox label="Orders" checked={syncOrders} onChange={setSyncOrders} />
          
          <Divider />
          
          <Text variant="headingMd" as="h2">Migration Options</Text>
          
          <Checkbox label="Only records modified after: 2026-01-01" checked={false} onChange={() => {}} />
          <Checkbox label="Skip existing records" checked={false} onChange={() => {}} />
          <Checkbox label="Update existing records" checked={true} onChange={() => {}} />
          <Checkbox label="Preserve NetSuite IDs" checked={true} onChange={() => {}} />
          
          <Box paddingBlockStart="400">
            <Button variant="primary" onClick={() => setMigrating(true)} disabled={migrating}>
              {migrating ? "Migrating..." : "Start Migration"}
            </Button>
          </Box>
        </BlockStack>
      </Card>
      
      {migrating && (
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2">Products</Text>
              <Text as="span">82%</Text>
            </InlineStack>
            <ProgressBar progress={82} tone="success" />
            
            <Text as="p">4,120 / 5,000</Text>
            
            <BlockStack gap="200">
              <Text as="p">Created: 3,810</Text>
              <Text as="p">Updated: 275</Text>
              <Text as="p">Skipped: 20</Text>
              <Text as="p">Failed: 15</Text>
            </BlockStack>
            
            <Button>View Errors</Button>
          </BlockStack>
        </Card>
      )}
    </BlockStack>
  );
}
