import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, Form } from "@remix-run/react";
import { Page, Layout, Card, Text, BlockStack, InlineGrid, Button, IndexTable, Badge, InlineStack, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const dbShop = await prisma.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!dbShop) {
    return { rulesCount: 0, contractsCount: 0, activeGroupsCount: 0, shop, sellingPlanGroups: [] };
  }

  const rulesCount = await prisma.subscriptionRule.count({
    where: { shopId: dbShop.id, activeStatus: true },
  });

  const contractsCount = await prisma.subscriptionContract.count({
    where: { shopId: dbShop.id, status: "ACTIVE" },
  });

  const activeGroupsCount = await prisma.sellingPlanGroup.count({
    where: { shopId: dbShop.id, status: "ACTIVE" },
  });

  const activeUsersRaw = await prisma.subscriptionContract.findMany({
    where: { shopId: dbShop.id, status: "ACTIVE" },
    select: { shopifyCustomerId: true },
    distinct: ['shopifyCustomerId'],
  });
  const activeUsersCount = activeUsersRaw.length;

  const sellingPlanGroups = await prisma.sellingPlanGroup.findMany({
    where: { shopId: dbShop.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { rulesCount, contractsCount, activeGroupsCount, activeUsersCount, shop, sellingPlanGroups };
};

export default function Dashboard() {
  const { rulesCount, contractsCount, activeGroupsCount, activeUsersCount, shop, sellingPlanGroups } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const rowMarkup = sellingPlanGroups.map((group, index) => (
    <IndexTable.Row id={group.id.toString()} key={group.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {group.groupName}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{group.merchantCode}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={group.status === "ACTIVE" ? "success" : "critical"}>
          {group.status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{new Date(group.createdAt).toLocaleDateString()}</IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200" blockAlign="center">
          <Button size="micro" onClick={() => navigate(`/app/plans/${group.id}`)}>
            Edit
          </Button>
          <Form method="post" action={`/app/plans/${group.id}`}>
            <input type="hidden" name="intent" value="toggle_status" />
            <Button size="micro" tone={group.status === "ACTIVE" ? "critical" : "success"} submit>
              {group.status === "ACTIVE" ? "Deactivate" : "Activate"}
            </Button>
          </Form>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Subscription Overview"
      fullWidth
      primaryAction={{
        content: "Create New Plan",
        onAction: () => navigate("/app/plans/new")
      }}
      secondaryActions={[
        {
          content: "Subscription logs",
          onAction: () => navigate("/app/subscription-logs")
        },
        {
          content: "Recent Subscription Plans",
          onAction: () => navigate("/app/plans")
        }
      ]}
    >
      <style>{`
        /* Ultra-Premium SaaS Dashboard Styling */
        .dashboard-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 0;
        }
        
        .hero-banner {
          background: linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: #1f2937;
          padding: 2.5rem;
          border-radius: 20px;
          margin-bottom: 2rem;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
          position: relative;
          overflow: hidden;
        }
        .hero-banner::before {
          content: '';
          position: absolute;
          top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%);
          pointer-events: none;
        }
        .hero-title {
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 0.75rem;
          color: #111827;
        }
        .hero-subtitle {
          font-size: 1.05rem;
          color: #4b5563;
          max-width: 600px;
          line-height: 1.5;
        }
        
        .stat-card {
          background: #ffffff;
          border-radius: 20px;
          padding: 1.75rem;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.03), 0 0 3px rgba(0,0,0,0.01);
          border: 1px solid rgba(229, 231, 235, 0.5);
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease;
          position: relative;
          overflow: hidden;
        }
        .stat-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 30px -5px rgba(0, 0, 0, 0.07), 0 10px 15px -5px rgba(0, 0, 0, 0.03);
        }
        .stat-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 4px;
          background: linear-gradient(90deg, var(--accent-1), var(--accent-2));
          opacity: 0.8;
        }
        
        .stat-title {
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6b7280;
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .stat-value {
          font-size: 2.75rem;
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.03em;
          line-height: 1;
        }

        .card-1 { --accent-1: #3b82f6; --accent-2: #8b5cf6; }
        .card-2 { --accent-1: #10b981; --accent-2: #34d399; }
        .card-3 { --accent-1: #f59e0b; --accent-2: #fbbf24; }
        .card-4 { --accent-1: #ec4899; --accent-2: #f43f5e; }

        .table-container {
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(229, 231, 235, 0.5);
          overflow: hidden;
          margin-top: 1rem;
        }
        .table-header {
          padding: 1.75rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #f3f4f6;
          background: #fafafa;
        }
        .table-header-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
        }
      `}</style>

      <div className="dashboard-container">
        <BlockStack gap="500">
          <div className="hero-banner">
            <div className="hero-title">Welcome back, {shop}</div>
            <div className="hero-subtitle">Gain deep insights into your subscription metrics, manage your recurring revenue, and effortlessly control your active selling plans.</div>
          </div>

          <Layout>
            <Layout.Section>
              <InlineGrid gap="400" columns={{ xs: 1, sm: 2, md: 4 }}>
                <div className="stat-card card-1">
                  <div className="stat-title">
                    <span style={{ fontSize: '1.2rem' }}>📦</span> Active Plans
                  </div>
                  <div className="stat-value">{activeGroupsCount}</div>
                </div>
                <div className="stat-card card-2">
                  <div className="stat-title">
                    <span style={{ fontSize: '1.2rem' }}>⚙️</span> Subscription Rules
                  </div>
                  <div className="stat-value">{rulesCount}</div>
                </div>
                <div className="stat-card card-3">
                  <div className="stat-title">
                    <span style={{ fontSize: '1.2rem' }}>📄</span> Active Contracts
                  </div>
                  <div className="stat-value">{contractsCount}</div>
                </div>
                <div className="stat-card card-4">
                  <div className="stat-title">
                    <span style={{ fontSize: '1.2rem' }}>👥</span> Active Users
                  </div>
                  <div className="stat-value">{activeUsersCount}</div>
                </div>
              </InlineGrid>
            </Layout.Section>

            <Layout.Section>
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-title">Recent Subscription Plans</div>
                  <Button variant="primary" onClick={() => navigate("/app/plans/new")}>
                    Create New Plan
                  </Button>
                </div>

                {sellingPlanGroups.length === 0 ? (
                  <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                    <Text as="p" tone="subdued">
                      You currently have no active selling plan groups on your store.
                    </Text>
                  </div>
                ) : (
                  <IndexTable
                    resourceName={{ singular: 'plan', plural: 'plans' }}
                    itemCount={sellingPlanGroups.length}
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
                )}
              </div>
            </Layout.Section>
          </Layout>
        </BlockStack>
      </div>
    </Page>
  );
}
