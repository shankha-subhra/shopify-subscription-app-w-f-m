import { Card, Text, BlockStack } from "@shopify/polaris";

export default function NetSuiteLogs() {
  return (
    <BlockStack gap="500">
      <Text variant="headingLg" as="h1">Sync Logs & Errors</Text>
      <Card>
        <Text as="p">Review detailed error logs and retry failed sync operations here.</Text>
      </Card>
    </BlockStack>
  );
}
