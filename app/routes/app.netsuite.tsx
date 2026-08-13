import { Outlet, Link, useLocation } from "@remix-run/react";
import { Page, Card, Navigation, Frame, Grid } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function NetSuiteLayout() {
  const location = useLocation();

  return (
    <Frame>
      <style>{`
        nav.Polaris-Navigation {
            width: 100%;
            max-width: 100%;
        }
      `}</style>
      <Page title="NetSuite Integration" fullWidth>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 4fr", gap: "var(--p-space-400)", alignItems: "start" }}>
          <div>
            <Card padding="0">
              <Navigation location={location.pathname}>
                <Navigation.Section
                  items={[
                    {
                      url: "/app/netsuite",
                      label: "Overview",
                      selected: location.pathname === "/app/netsuite",
                    },
                    {
                      url: "/app/netsuite/settings",
                      label: "Settings",
                      selected: location.pathname.includes("/app/netsuite/settings"),
                    },
                    {
                      url: "/app/netsuite/migration",
                      label: "Migration",
                      selected: location.pathname.includes("/app/netsuite/migration"),
                    },
                    {
                      url: "/app/netsuite/mapping",
                      label: "Field Mapping",
                      selected: location.pathname.includes("/app/netsuite/mapping"),
                    },
                    {
                      url: "/app/netsuite/sync",
                      label: "Synchronization",
                      selected: location.pathname.includes("/app/netsuite/sync"),
                    },
                    {
                      url: "/app/netsuite/logs",
                      label: "Sync Logs",
                      selected: location.pathname.includes("/app/netsuite/logs"),
                    },
                  ]}
                />
              </Navigation>
            </Card>
          </div>

          <div>
            <Outlet />
          </div>
        </div>
      </Page>
    </Frame>
  );
}
