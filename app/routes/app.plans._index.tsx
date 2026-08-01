import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, Form } from "@remix-run/react";
import { Page, Card, IndexTable, Text, Badge, Button } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const dbShop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
  });

  if (!dbShop) {
    return { plans: [] };
  }

  const plans = await prisma.sellingPlanGroup.findMany({
    where: { shopId: dbShop.id },
    orderBy: { createdAt: "desc" },
  });

  return { plans };
};

export default function PlansList() {
  const { plans } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const rowMarkup = plans.map(
    (plan, index) => (
      <IndexTable.Row id={plan.id.toString()} key={plan.id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {plan.groupName}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{plan.merchantCode}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={plan.status === "ACTIVE" ? "success" : "critical"}>
            {plan.status}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{new Date(plan.createdAt).toLocaleDateString()}</IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="micro" onClick={() => navigate(`/app/plans/${plan.id}`)}>
              Edit
            </Button>
            <Form method="post" action={`/app/plans/${plan.id}`}>
              <input type="hidden" name="intent" value="toggle_status" />
              <Button size="micro" tone={plan.status === "ACTIVE" ? "critical" : "success"} submit>
                {plan.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </Button>
            </Form>
          </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <Page
      title="Subscription Plans"
      primaryAction={<Button variant="primary" onClick={() => navigate("/app/plans/new")}>Create Plan</Button>}
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: 'plan', plural: 'plans' }}
          itemCount={plans.length}
          headings={[
            { title: 'Plan Name' },
            { title: 'Merchant Code' },
            { title: 'Status' },
            { title: 'Created At' },
            { title: 'Actions' },
          ]}
          selectable={false}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
