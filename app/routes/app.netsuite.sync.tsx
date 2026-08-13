import { Card, Text, BlockStack } from "@shopify/polaris";

export default function NetSuiteSyncHistory() {
  return (
    <BlockStack gap="500">
      <Text variant="headingLg" as="h1">Synchronization</Text>
      <Card>
        <Text as="p">View active sync jobs and history here.</Text>
      </Card>
    </BlockStack>
  );
}
