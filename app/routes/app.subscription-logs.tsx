import {
  Page,
  Layout,
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Badge,
} from "@shopify/polaris";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
  });

  if (!shop) {
    return json({ logs: [] });
  }

  const logs = await prisma.webhookEvent.findMany({
    where: { shopId: shop.id },
    orderBy: { receivedDate: "desc" },
    take: 50,
  });

  return json({ logs });
}

export default function SubscriptionWebhookLogs() {
  const { logs } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(logs as any);

  const rowMarkup = logs.map(
    (
      {
        id,
        webhookTopic,
        processingStatus,
        receivedDate,
        processedDate,
        errorMessage,
      },
      index
    ) => (
      <IndexTable.Row
        id={id.toString()}
        key={id}
        selected={selectedResources.includes(id.toString())}
        position={index}
      >
        <IndexTable.Cell>{new Date(receivedDate).toLocaleString()}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {webhookTopic}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {processingStatus === "SUCCESS" || processingStatus === "PROCESSED" ? (
            <Badge tone="success">{processingStatus}</Badge>
          ) : processingStatus === "FAILED" || processingStatus === "ERROR" ? (
            <Badge tone="critical">{processingStatus}</Badge>
          ) : (
            <Badge tone="attention">{processingStatus}</Badge>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {processedDate ? new Date(processedDate).toLocaleString() : "-"}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {errorMessage ? (
            <Text tone="critical" as="span">
              {errorMessage}
            </Text>
          ) : (
            <Text tone="subdued" as="span">
              None
            </Text>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page title="Subscription Webhook Logs" backAction={{ content: "Rules", url: "/app/shipping-rules" }}>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={{ singular: "webhook log", plural: "webhook logs" }}
              itemCount={logs.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "Received Date" },
                { title: "Topic" },
                { title: "Status" },
                { title: "Processed Date" },
                { title: "Error" },
              ]}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
