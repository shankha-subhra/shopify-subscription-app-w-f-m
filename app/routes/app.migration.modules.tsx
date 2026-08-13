import { Card, Text, BlockStack, ChoiceList, Button, Box, Divider, InlineStack, Checkbox, ProgressBar } from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import db from "../db.server";

import { importProductsToShopify } from "../services/migration/product-import.server";
import { importCustomersToShopify } from "../services/migration/customer-import.server";
import { importOrdersToShopify } from "../services/migration/order-import.server";
import { importCouponsToShopify } from "../services/migration/coupon-import.server";
import { importCategoriesToShopify } from "../services/migration/category-import.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const jobs = await db.externalSyncJob.findMany({
    where: { shop },
    orderBy: { createdAt: 'desc' }
  });

  const latestJobs = jobs.reduce((acc: Record<string, any>, job) => {
    if (!acc[job.jobName]) {
      acc[job.jobName] = job;
    }
    return acc;
  }, {});

  return json({ latestJobs });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const modulesRaw = formData.get("modules") as string;
  
  if (actionType === "import_everything" || actionType === "start_selected") {
     const selectedModules = modulesRaw ? JSON.parse(modulesRaw) : {};
     
     const modulesToRun = actionType === "import_everything" 
       ? ['categories', 'products', 'customers', 'coupons', 'orders']
       : Object.keys(selectedModules).filter(k => selectedModules[k as keyof typeof selectedModules]);
       
     for (const mod of modulesToRun) {
       await db.externalSyncJob.create({
         data: {
           shop: session.shop,
           jobName: `import_${mod}`,
           status: "processing",
           totalRecords: 100, // Dummy value so the progress bar is visible
           processedRecords: 10 // Dummy progress
         }
       });
       
       // Fire and forget background execution
       if (mod === 'products') importProductsToShopify(session.shop, session).catch(console.error);
       if (mod === 'customers') importCustomersToShopify(session.shop, session).catch(console.error);
       if (mod === 'orders') importOrdersToShopify(session.shop, session).catch(console.error);
       if (mod === 'coupons') importCouponsToShopify(session.shop, session).catch(console.error);
       if (mod === 'categories') importCategoriesToShopify(session.shop, session).catch(console.error);
     }
  }
  
  return json({ success: true });
};

export default function MigrationModules() {
  const { latestJobs } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [migrationMode, setMigrationMode] = useState(["import_update"]);
  
  const [modules, setModules] = useState({
    categories: false,
    products: false,
    customers: false,
    coupons: false,
    orders: false,
  });

  const toggleModule = (key: keyof typeof modules) => {
    setModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    setModules({
      categories: true,
      products: true,
      customers: true,
      coupons: true,
      orders: true,
    });
  };

  const handleStart = (actionType: "import_everything" | "start_selected") => {
    const formData = new FormData();
    formData.append("actionType", actionType);
    if (actionType === "start_selected") {
      formData.append("modules", JSON.stringify(modules));
    }
    submit(formData, { method: "post" });
    shopify.toast.show("Migration started in the background!");
  };

  const handleStartIndividual = (mod: string) => {
    const formData = new FormData();
    formData.append("actionType", "start_selected");
    formData.append("modules", JSON.stringify({ [mod]: true }));
    submit(formData, { method: "post" });
    shopify.toast.show("Migration started in the background!");
  };

  const renderProgress = (title: string, jobName: string) => {
    const job = latestJobs[jobName] || { totalRecords: 0, processedRecords: 0, createdRecords: 0, updatedRecords: 0, failedRecords: 0 };
    const progress = job.totalRecords > 0 ? Math.round((job.processedRecords / job.totalRecords) * 100) : 0;
    const tone = job.failedRecords > 0 ? "critical" : progress === 100 ? "success" : "highlight";
    
    return (
      <>
        <Box paddingBlockStart="300" paddingBlockEnd="300">
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h3">{title}</Text>
              <Text as="span">{progress}%</Text>
            </InlineStack>
            <ProgressBar progress={progress} tone={tone} />
            <Text as="p">{job.processedRecords} / {job.totalRecords}</Text>
            <InlineStack gap="300">
              <Text as="span">Created: {job.createdRecords}</Text>
              <Text as="span">Updated: {job.updatedRecords}</Text>
              <Text as="span">Failed: {job.failedRecords}</Text>
            </InlineStack>
          </BlockStack>
        </Box>
        <Divider />
      </>
    );
  };

  return (
    <BlockStack gap="500">
      <Text variant="headingLg" as="h1">Migration Modules</Text>
      
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Select Data to Import</Text>
          
          <Checkbox label="Categories" checked={modules.categories} onChange={() => toggleModule('categories')} />
          <Checkbox label="Products (includes Variants & Inventory)" checked={modules.products} onChange={() => toggleModule('products')} />
          <Checkbox label="Customers" checked={modules.customers} onChange={() => toggleModule('customers')} />
          <Checkbox label="Discount Coupons" checked={modules.coupons} onChange={() => toggleModule('coupons')} />
          <Checkbox label="Orders" checked={modules.orders} onChange={() => toggleModule('orders')} />
          
          <Box paddingBlockStart="200">
            <Button onClick={selectAll}>Select All</Button>
          </Box>
          
          <Divider />
          
          <ChoiceList
            title="Migration Mode"
            choices={[
              {label: 'Import new + update existing', value: 'import_update'},
              {label: 'Import new only', value: 'import_only'},
              {label: 'Update existing only', value: 'update_only'},
            ]}
            selected={migrationMode}
            onChange={setMigrationMode}
          />
          
          <Box paddingBlockStart="400">
            <InlineStack gap="300">
              <Button variant="primary" tone="success" onClick={() => handleStart("import_everything")}>Import Everything</Button>
              <Button variant="primary" onClick={() => handleStart("start_selected")}>Start Selected Migration</Button>
            </InlineStack>
          </Box>
        </BlockStack>
      </Card>
      
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Individual Module Actions</Text>
          <InlineStack gap="300" wrap>
            <Button onClick={() => handleStartIndividual('categories')}>Import Categories</Button>
            <Button onClick={() => handleStartIndividual('products')}>Import Products</Button>
            <Button onClick={() => handleStartIndividual('customers')}>Import Customers</Button>
            <Button onClick={() => handleStartIndividual('coupons')}>Import Coupons</Button>
            <Button onClick={() => handleStartIndividual('orders')}>Import Orders</Button>
          </InlineStack>
        </BlockStack>
      </Card>
      
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Migration Progress</Text>
          
          {renderProgress("Products", "import_products")}
          {renderProgress("Customers", "import_customers")}
          {renderProgress("Orders", "import_orders")}
          {renderProgress("Coupons", "import_coupons")}
          {renderProgress("Categories", "import_categories")}
          
          <Box paddingBlockStart="400">
            <InlineStack gap="300">
              <Button onClick={() => window.location.href='/app/migration/logs'}>View Logs</Button>
              <Button>Retry Failed</Button>
              <Button>Re-run Migration</Button>
            </InlineStack>
          </Box>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
