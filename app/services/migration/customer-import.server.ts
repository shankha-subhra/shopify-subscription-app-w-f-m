import { fetchExternalCustomers } from "../external-api/customers.server";
import { resolveShopifyId, saveMapping } from "../external-api/mapper.server";
import { logCreation } from "./logger.server";
import { unauthenticated } from "../../shopify.server";
import db from "../../db.server";

export async function importCustomersToShopify(shop: string, session: any) {
  const customers = await fetchExternalCustomers(shop);
  const { admin } = await unauthenticated.admin(shop);

  for (const customer of customers) {
    let currentInput: any = null;
    try {
      const customerId = customer.id || customer.email || Math.random().toString(36).substr(2, 9);
      const existingMap = await resolveShopifyId(shop, 'customer', customerId);
      
      const input = {
        firstName: customer.name?.firstname,
        lastName: customer.name?.lastname,
        email: customer.email,
        addresses: [{
          address1: `${customer.address?.number || ''} ${customer.address?.street || ''}`.trim() || '123 Fake St',
          city: customer.address?.city || 'Nowhere',
          zip: customer.address?.zipcode || '00000',
          country: "US" // Default since FakeStore doesn't provide
        }]
      };
      
      currentInput = input;
      let responseData: any = null;
      let shopifyId = existingMap?.shopifyId;
      
      if (existingMap && existingMap.shopifyId) {
        // Update
        const response = await admin.graphql(
          `#graphql
            mutation customerUpdate($input: CustomerInput!) {
              customerUpdate(input: $input) {
                customer { id }
                userErrors { field message }
              }
            }`,
          { variables: { input: { id: existingMap.shopifyId, ...input } } }
        );
        const { data } = await response.json();
        responseData = data;
        logCreation(shop, 'customer-update', '/graphql.json', { id: existingMap.shopifyId, ...input }, data);
        
        if (data?.customerUpdate?.userErrors?.length > 0) {
          throw new Error(data.customerUpdate.userErrors.map((e: any) => e.message).join(", "));
        }
      } else {
        // Create
        const response = await admin.graphql(
          `#graphql
            mutation customerCreate($input: CustomerInput!) {
              customerCreate(input: $input) {
                customer { id }
                userErrors { field message }
              }
            }`,
          { variables: { input } }
        );
        const { data } = await response.json();
        responseData = data;
        logCreation(shop, 'customer-create', '/graphql.json', input, data);
        
        if (data?.customerCreate?.userErrors?.length > 0) {
          throw new Error(data.customerCreate.userErrors.map((e: any) => e.message).join(", "));
        } else if (data?.customerCreate?.customer?.id) {
          shopifyId = data.customerCreate.customer.id;
          await saveMapping(shop, 'customer', customer.id, shopifyId);
        }
      }
      
      await db.externalSyncLog.create({
        data: {
          shop,
          entityType: 'customer',
          externalId: String(customerId),
          shopifyId: shopifyId,
          endpoint: '/graphql.json',
          status: 'SUCCESS',
          requestPayload: JSON.stringify(currentInput),
          responsePayload: JSON.stringify(responseData)
        }
      });
    } catch (error: any) {
      const customerId = customer.id || customer.email || 'unknown';
      console.error(`[importCustomersToShopify] Failed for customer ${customerId}:`, error.message);
      await db.externalSyncLog.create({
        data: {
          shop,
          entityType: 'customer',
          externalId: String(customerId),
          endpoint: '/graphql.json',
          status: 'FAILED',
          requestPayload: currentInput ? JSON.stringify(currentInput) : JSON.stringify(customer),
          errorMessage: error.message || 'Unknown error'
        }
      });
    }
  }
}
