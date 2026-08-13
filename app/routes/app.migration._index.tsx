import { Card, Text, BlockStack, InlineStack, Badge, Button, Box } from "@shopify/polaris";
import { Link, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function MigrationOverview() {
  const navigate = useNavigate();

  return (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h1">
        Source Status
      </Text>
      
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text variant="headingMd" as="h2">FakeStore API</Text>
            <Badge tone="success">Connected</Badge>
          </InlineStack>
          
          <Text as="p">
            API URL: <strong>https://fakestoreapi.noksha.dev/api</strong>
          </Text>
          
          <InlineStack gap="300">
            <Button variant="primary">Test Connection</Button>
          </InlineStack>
        </BlockStack>
      </Card>
      
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Quick Actions</Text>
          <Box paddingBlockStart="200">
            <Button variant="primary" onClick={() => navigate("/app/migration/modules")}>Go to Migration Modules</Button>
          </Box>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
