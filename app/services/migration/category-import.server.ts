import { fetchExternalCategories } from "../external-api/categories.server";
import { resolveShopifyId, saveMapping } from "../external-api/mapper.server";
import { logCreation } from "./logger.server";
import { unauthenticated } from "../../shopify.server";
import db from "../../db.server";

export async function importCategoriesToShopify(shop: string, session: any) {
  const categories = await fetchExternalCategories(shop);
  const { admin } = await unauthenticated.admin(shop);

  for (const category of categories) {
    let currentInput: any = null;
    try {
      // FakeStore category is just a string, e.g. "electronics", so we use the string as the ID
      const existingMap = await resolveShopifyId(shop, 'category', category);
      
      const input = {
        title: category.charAt(0).toUpperCase() + category.slice(1),
        descriptionHtml: `Imported collection for ${category}`,
      };
      
      currentInput = input;
      let responseData: any = null;
      let shopifyId = existingMap?.shopifyId;
      
      if (existingMap && existingMap.shopifyId) {
        // Update
        const response = await admin.graphql(
          `#graphql
            mutation collectionUpdate($input: CollectionInput!) {
              collectionUpdate(input: $input) {
                collection { id }
                userErrors { field message }
              }
            }`,
          { variables: { input: { id: existingMap.shopifyId, ...input } } }
        );
        const { data } = await response.json();
        responseData = data;
        logCreation(shop, 'category-update', '/graphql.json', { id: existingMap.shopifyId, ...input }, data);
        
        if (data?.collectionUpdate?.userErrors?.length > 0) {
          throw new Error(data.collectionUpdate.userErrors.map((e: any) => e.message).join(", "));
        }
      } else {
        // Create
        const response = await admin.graphql(
          `#graphql
            mutation collectionCreate($input: CollectionInput!) {
              collectionCreate(input: $input) {
                collection { id }
                userErrors { field message }
              }
            }`,
          { variables: { input } }
        );
        const { data } = await response.json();
        responseData = data;
        logCreation(shop, 'category-create', '/graphql.json', input, data);
        
        if (data?.collectionCreate?.userErrors?.length > 0) {
          throw new Error(data.collectionCreate.userErrors.map((e: any) => e.message).join(", "));
        } else if (data?.collectionCreate?.collection?.id) {
          shopifyId = data.collectionCreate.collection.id;
          await saveMapping(shop, 'category', category, shopifyId);
        }
      }

      await db.externalSyncLog.create({
        data: {
          shop,
          entityType: 'category',
          externalId: category,
          shopifyId: shopifyId,
          endpoint: '/graphql.json',
          status: 'SUCCESS',
          requestPayload: JSON.stringify(currentInput),
          responsePayload: JSON.stringify(responseData)
        }
      });
    } catch (error: any) {
      console.error(`[importCategoriesToShopify] Failed for category ${category}:`, error.message);
      await db.externalSyncLog.create({
        data: {
          shop,
          entityType: 'category',
          externalId: category,
          endpoint: '/graphql.json',
          status: 'FAILED',
          requestPayload: currentInput ? JSON.stringify(currentInput) : JSON.stringify(category),
          errorMessage: error.message || 'Unknown error'
        }
      });
    }
  }
}
