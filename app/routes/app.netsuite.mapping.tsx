import { Card, Text, BlockStack } from "@shopify/polaris";

export default function NetSuiteMapping() {
  return (
    <BlockStack gap="500">
      <Text variant="headingLg" as="h1">Field Mapping</Text>
      <Card>
        <Text as="p">Configure mapping between NetSuite Custom Fields and Shopify Metafields.</Text>
      </Card>
    </BlockStack>
  );
}
