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
  const logs = await prisma.shippingCalculationLog.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return json({ logs });
}

export default function ShippingLogs() {
  const { logs } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(logs as any);

  const rowMarkup = logs.map(
    (
      {
        id,
        countryCode,
        stateCode,
        postalCode,
        cartQuantity,
        calculationSource,
        calculatedPrice,
        currency,
        shippingMethodName,
        status,
        createdAt,
      },
      index
    ) => (
      <IndexTable.Row
        id={id.toString()}
        key={id}
        selected={selectedResources.includes(id.toString())}
        position={index}
      >
        <IndexTable.Cell>{new Date(createdAt).toLocaleString()}</IndexTable.Cell>
        <IndexTable.Cell>
          {countryCode || "-"}/{stateCode || "-"}/{postalCode || "-"}
        </IndexTable.Cell>
        <IndexTable.Cell>{cartQuantity}</IndexTable.Cell>
        <IndexTable.Cell>{calculationSource}</IndexTable.Cell>
        <IndexTable.Cell>{shippingMethodName}</IndexTable.Cell>
        <IndexTable.Cell>
          {calculatedPrice} {currency}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {status === "SUCCESS" ? <Badge tone="success">Success</Badge> : <Badge tone="critical">Error</Badge>}
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page title="Shipping Calculation Logs" backAction={{ content: "Rules", url: "/app/shipping-rules" }}>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={{ singular: "log", plural: "logs" }}
              itemCount={logs.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "Date" },
                { title: "Destination" },
                { title: "Quantity" },
                { title: "Source" },
                { title: "Method" },
                { title: "Price" },
                { title: "Status" },
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
