import { Outlet, Link, useLocation } from "@remix-run/react";
import { Page, Card, Navigation, Frame } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function MigrationLayout() {
  const location = useLocation();

  return (
    <Frame>
      <style>{`
        nav.Polaris-Navigation {
            width: 100%;
            max-width: 100%;
        }
      `}</style>
      <Page title="External API Migration" fullWidth>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 4fr", gap: "var(--p-space-400)", alignItems: "start" }}>
          <div>
            <Card padding="0">
              <Navigation location={location.pathname}>
                <Navigation.Section
                  items={[
                    {
                      url: "/app/migration",
                      label: "Source Status",
                      selected: location.pathname === "/app/migration",
                    },
                    {
                      url: "/app/migration/modules",
                      label: "Migration Modules",
                      selected: location.pathname.includes("/app/migration/modules"),
                    },
                    {
                      url: "/app/migration/settings",
                      label: "Settings",
                      selected: location.pathname.includes("/app/migration/settings"),
                    },
                    {
                      url: "/app/migration/logs",
                      label: "Sync Logs",
                      selected: location.pathname.includes("/app/migration/logs"),
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
