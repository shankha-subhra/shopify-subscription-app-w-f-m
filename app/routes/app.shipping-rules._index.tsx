import {
  Page,
  Layout,
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Badge,
  Button,
  ButtonGroup,
} from "@shopify/polaris";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  if (request.method === "DELETE") {
    const idsString = formData.get("ids") as string;
    if (idsString) {
      const ids = idsString.split(",").map(Number);
      await prisma.shippingRule.deleteMany({
        where: {
          shop: session.shop,
          id: { in: ids },
        },
      });
    }
    return json({ success: true });
  }

  return json({ success: false });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const rules = await prisma.shippingRule.findMany({
    where: { shop: session.shop },
    orderBy: { priority: "desc" },
  });

  const response = await admin.graphql(
    `#graphql
      query getShopCurrency {
        shop {
          currencyCode
        }
      }
    `
  );
  const shopData = await response.json();
  const storeCurrency = shopData?.data?.shop?.currencyCode || "USD";

  return json({ rules, storeCurrency });
}

export default function ShippingRulesIndex() {
  const { rules, storeCurrency } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(rules as any);

  const promotedBulkActions = [
    {
      content: "Delete rules",
      onAction: () => {
        if (confirm("Are you sure you want to delete the selected rules?")) {
          const formData = new FormData();
          formData.append("ids", selectedResources.join(","));
          submit(formData, { method: "delete" });
          clearSelection();
        }
      },
    },
  ];

  const rowMarkup = rules.map(
    (
      {
        id,
        ruleName,
        shippingMethodName,
        shippingPrice,
        currency,
        priority,
        isActive,
        updatedAt,
      },
      index
    ) => (
      <IndexTable.Row
        id={id.toString()}
        key={id}
        selected={selectedResources.includes(id.toString())}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {ruleName}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{shippingMethodName}</IndexTable.Cell>
        <IndexTable.Cell>
          {shippingPrice} {storeCurrency}
        </IndexTable.Cell>
        <IndexTable.Cell>{priority}</IndexTable.Cell>
        <IndexTable.Cell>
          {isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
        </IndexTable.Cell>
        <IndexTable.Cell>{new Date(updatedAt).toLocaleDateString()}</IndexTable.Cell>
        <IndexTable.Cell>
          <ButtonGroup>
            <Button onClick={() => navigate(`/app/shipping-rules/${id}`)}>Edit</Button>
            <Button
              tone="critical"
              onClick={() => {
                if (confirm("Are you sure you want to delete this rule?")) {
                  const formData = new FormData();
                  formData.append("ids", id.toString());
                  submit(formData, { method: "delete" });
                }
              }}
            >
              Delete
            </Button>
          </ButtonGroup>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page
      title="Shipping Rules"
      primaryAction={{
        content: "Create rule",
        onAction: () => navigate("/app/shipping-rules/new"),
      }}
      secondaryActions={[
        {
          content: "Settings",
          onAction: () => navigate("/app/shipping-settings"),
        },
        {
          content: "Rate Tester",
          onAction: () => navigate("/app/shipping-tester"),
        },
        {
          content: "Shipping Logs",
          onAction: () => navigate("/app/shipping-logs"),
        },
      ]}
    >
      <style>{`
        .Polaris-Card {
          transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.2s ease-in-out;
        }
        .Polaris-Card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08) !important;
        }
        .Polaris-IndexTable__TableRow {
          transition: background-color 0.2s ease, transform 0.15s ease;
        }
        .Polaris-IndexTable__TableRow:hover {
          background-color: #f6f6f7 !important;
          transform: scale(1.002);
          z-index: 10;
          position: relative;
          box-shadow: inset 2px 0 0 0 #005bd3;
        }
        .Polaris-Button {
          transition: all 0.2s ease;
        }
        .Polaris-Button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
        .Polaris-Button--toneCritical:hover {
          box-shadow: 0 4px 8px rgba(216,44,13,0.2) !important;
        }
      `}</style>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={{ singular: "rule", plural: "rules" }}
              itemCount={rules.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              promotedBulkActions={promotedBulkActions}
              bulkActions={promotedBulkActions}
              headings={[
                { title: "Name" },
                { title: "Method" },
                { title: "Price" },
                { title: "Priority" },
                { title: "Status" },
                { title: "Updated" },
                { title: "Actions" },
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
