import { Card, Text, BlockStack, InlineStack, Badge, Button } from "@shopify/polaris";
import { Link } from "@remix-run/react";

export default function NetSuiteOverview() {
  return (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h1">
        NetSuite Overview
      </Text>
      
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text variant="headingMd" as="h2">Connection Status</Text>
            <Badge tone="success">Connected</Badge>
          </InlineStack>
          
          <Text as="p">
            Connected to NetSuite Account: <strong>XXXXXXX</strong>
          </Text>
          
          <InlineStack gap="300">
            <Button variant="primary">Test Connection</Button>
            <Button tone="critical">Disconnect</Button>
          </InlineStack>
        </BlockStack>
      </Card>
      
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Recent Sync Activity</Text>
          <Text as="p" tone="subdued">No recent sync activity.</Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
