import { fetchExternalProducts } from "../external-api/products.server";
import { resolveShopifyId, saveMapping } from "../external-api/mapper.server";
import { logCreation } from "./logger.server";
import { unauthenticated } from "../../shopify.server";
import db from "../../db.server";

export async function importProductsToShopify(shop: string, session: any) {
  const products = await fetchExternalProducts(shop);
  const { admin } = await unauthenticated.admin(shop);

  // Get up to 10 locations to assign inventory
  const locRes = await admin.graphql(`{ locations(first: 10) { edges { node { id } } } }`);
  const locData = await locRes.json();
  const locations = locData.data?.locations?.edges?.map((e: any) => e.node.id) || [];

  for (const product of products) {
    let currentVariables: any = null;
    try {
      const productId = product.id || product._id;
      const existingMap = await resolveShopifyId(shop, 'product', productId);
      
      const sizes = Array.isArray(product.size) ? product.size : [];
      const baseStock = typeof product.stock === 'number' ? product.stock : 50;

      let productOptions: any[] = [];
      let variants: any[] = [];
      
      const locationsCount = locations.length || 1;

      if (sizes.length > 0) {
        productOptions = [{
          name: "Size",
          values: sizes.map((size: string) => ({ name: String(size) }))
        }];
        
        const variantStock = Math.floor(baseStock / sizes.length);
        const stockPerLocation = Math.floor(variantStock / locationsCount);

        variants = sizes.map((size: string) => ({
          sku: `PROD-${productId}-${String(size).toUpperCase().replace(/\s+/g, '-')}`,
          optionValues: [{ name: String(size), optionName: "Size" }],
          price: String(product.price || 0),
          inventoryQuantities: locations.map((locId: string) => ({
            locationId: locId,
            name: "available",
            quantity: stockPerLocation
          }))
        }));
      } else {
        const stockPerLocation = Math.floor(baseStock / locationsCount);
        
        variants = [{
          sku: `PROD-${productId}-DEFAULT`,
          price: String(product.price || 0),
          inventoryQuantities: locations.map((locId: string) => ({
            locationId: locId,
            name: "available",
            quantity: stockPerLocation
          }))
        }];
      }

      const productInput: any = {
        title: product.title,
        descriptionHtml: product.description,
        vendor: product.brand || "FakeStoreAPI"
      };

      if (product.image) {
        productInput.files = [{
          contentType: "IMAGE",
          originalSource: String(product.image)
        }];
      }

      let variables: any = {
        synchronous: true,
        input: {
          ...productInput,
          ...(existingMap?.shopifyId ? { id: existingMap.shopifyId } : {}),
          ...(productOptions.length > 0 ? { productOptions } : {}),
          variants
        }
      };
      
      currentVariables = variables;

      let response = await admin.graphql(
        `#graphql
          mutation productSet($synchronous: Boolean!, $input: ProductSetInput!) {
            productSet(synchronous: $synchronous, input: $input) {
              product { id }
              userErrors { field message }
            }
          }`,
        { variables }
      );
      
      let { data } = await response.json();
      
      // Retry if mapping is stale
      if (data?.productSet?.userErrors?.some((e: any) => e.message === 'Product does not exist')) {
        delete variables.input.id;
        await db.externalSyncMapping.deleteMany({ where: { shop, entityType: 'product', externalId: String(productId) }});
        
        response = await admin.graphql(
          `#graphql
            mutation productSet($synchronous: Boolean!, $input: ProductSetInput!) {
              productSet(synchronous: $synchronous, input: $input) {
                product { id }
                userErrors { field message }
              }
            }`,
          { variables }
        );
        data = (await response.json()).data;
      }

      logCreation(shop, variables.input.id ? 'product-update' : 'product-create', '/graphql.json', variables.input, data);
      
      if (data?.productSet?.userErrors?.length > 0) {
        throw new Error(data.productSet.userErrors.map((e: any) => e.message).join(", "));
      } else if (data?.productSet?.product?.id && !variables.input.id) {
        await saveMapping(shop, 'product', productId, data.productSet.product.id);
      }

      // Store Success in DB Log
      await db.externalSyncLog.create({
        data: {
          shop,
          entityType: 'product',
          externalId: String(productId),
          shopifyId: data?.productSet?.product?.id || variables.input.id,
          endpoint: '/graphql.json',
          status: 'SUCCESS',
          requestPayload: JSON.stringify(variables.input),
          responsePayload: JSON.stringify(data)
        }
      });

    } catch (error: any) {
      const productId = product.id || product._id || 'unknown';
      console.error(`[importProductsToShopify] Failed for product ${productId}:`, error.message);
      await db.externalSyncLog.create({
        data: {
          shop,
          entityType: 'product',
          externalId: String(productId),
          endpoint: '/graphql.json',
          status: 'FAILED',
          requestPayload: currentVariables ? JSON.stringify(currentVariables.input) : JSON.stringify(product),
          errorMessage: error.message || 'Unknown error'
        }
      });
    }
  }
}
