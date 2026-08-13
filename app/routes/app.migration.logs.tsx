import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, Text, BlockStack, IndexTable, Badge, Button, InlineStack, Box, Modal } from "@shopify/polaris";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import { useState } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  const logs = await db.externalSyncLog.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return json({ logs });
}

export default function MigrationLogs() {
  const { logs } = useLoaderData<typeof loader>();
  const [activeLog, setActiveLog] = useState<any | null>(null);

  const formatJson = (str: string | null) => {
    if (!str) return "N/A";
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch (e) {
      return str;
    }
  };

  const rowMarkup = logs.map(
    (log, index) => {
      const { id, entityType, externalId, status, errorMessage, createdAt } = log;
      return (
        <IndexTable.Row id={id.toString()} key={id} position={index}>
          <IndexTable.Cell>
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {entityType.toUpperCase()}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>{externalId || "N/A"}</IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={status === "FAILED" ? "critical" : "success"}>
              {status}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span" tone="critical">
              {errorMessage || "-"}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>{new Date(createdAt).toLocaleString()}</IndexTable.Cell>
          <IndexTable.Cell>
            <InlineStack gap="200" wrap={false}>
              <Button size="micro" onClick={() => setActiveLog(log)}>View</Button>
              {status === "FAILED" && <Button size="micro" onClick={() => {}}>Retry</Button>}
            </InlineStack>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  return (
    <BlockStack gap="500">
      <InlineStack align="space-between">
        <Text variant="headingLg" as="h1">Sync Logs & Errors</Text>
        <Button variant="primary">Retry All Failed</Button>
      </InlineStack>

      <Card padding="0">
        <IndexTable
          resourceName={{ singular: "log", plural: "logs" }}
          itemCount={logs.length}
          headings={[
            { title: "Entity Type" },
            { title: "External ID" },
            { title: "Status" },
            { title: "Error Message" },
            { title: "Date" },
            { title: "Actions" },
          ]}
          selectable={false}
        >
          {rowMarkup.length > 0 ? rowMarkup : (
            <IndexTable.Row id="empty" position={0}>
              <IndexTable.Cell colSpan={6}>
                <Box padding="400">
                  <Text as="p" alignment="center">No logs found.</Text>
                </Box>
              </IndexTable.Cell>
            </IndexTable.Row>
          )}
        </IndexTable>
      </Card>

      {activeLog && (
        <Modal
          open={!!activeLog}
          onClose={() => setActiveLog(null)}
          title={`Log Details: ${activeLog.entityType.toUpperCase()} (${activeLog.externalId})`}
          large
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Endpoint URL</Text>
              <Text as="p">{activeLog.endpoint || "N/A"}</Text>

              <Text variant="headingMd" as="h2">Request Payload (Input)</Text>
              <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                <Text as="pre" variant="bodySm">{formatJson(activeLog.requestPayload)}</Text>
              </Box>

              <Text variant="headingMd" as="h2">Response Payload (Output)</Text>
              <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                <Text as="pre" variant="bodySm">{formatJson(activeLog.responsePayload) === "N/A" ? activeLog.errorMessage : formatJson(activeLog.responsePayload)}</Text>
              </Box>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </BlockStack>
  );
}
