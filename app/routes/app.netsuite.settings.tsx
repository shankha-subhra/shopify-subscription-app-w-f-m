import { Card, Text, BlockStack, ChoiceList, Button } from "@shopify/polaris";
import { useState } from "react";

export default function NetSuiteSettings() {
  const [productMaster, setProductMaster] = useState(["netsuite"]);
  const [customerMaster, setCustomerMaster] = useState(["twoway"]);
  const [orderMaster, setOrderMaster] = useState(["shopify"]);

  return (
    <BlockStack gap="500">
      <Text variant="headingLg" as="h1">NetSuite Settings</Text>
      
      <Card>
        <BlockStack gap="400">
          <ChoiceList
            title="Product Master"
            choices={[
              {label: 'NetSuite', value: 'netsuite'},
              {label: 'Shopify', value: 'shopify'},
              {label: 'Latest Update Wins', value: 'latest'},
            ]}
            selected={productMaster}
            onChange={setProductMaster}
          />
          
          <ChoiceList
            title="Customer Master"
            choices={[
              {label: 'NetSuite', value: 'netsuite'},
              {label: 'Shopify', value: 'shopify'},
              {label: 'Two Way', value: 'twoway'},
            ]}
            selected={customerMaster}
            onChange={setCustomerMaster}
          />
          
          <ChoiceList
            title="Orders Master"
            choices={[
              {label: 'NetSuite → Shopify', value: 'netsuite'},
              {label: 'Shopify → NetSuite', value: 'shopify'},
              {label: 'Two Way', value: 'twoway'},
            ]}
            selected={orderMaster}
            onChange={setOrderMaster}
          />

          <Button variant="primary">Save Settings</Button>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
