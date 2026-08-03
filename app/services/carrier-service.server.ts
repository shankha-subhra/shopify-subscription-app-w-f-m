import shopify from "../shopify.server";

export async function getCarrierService(admin: any) {
  const response = await admin.graphql(
    `#graphql
      query getCarrierServices {
        carrierServices(first: 10) {
          edges {
            node {
              id
              name
              callbackUrl
              active
            }
          }
        }
      }`
  );
  const data = await response.json();
  const services = data?.data?.carrierServices?.edges || [];
  return services.find((edge: any) => edge.node.name === "Custom Shipping Rules")?.node;
}

export async function createCarrierService(admin: any, appUrl: string) {
  const callbackUrl = `${appUrl}/api/shipping-rates`;
  
  const response = await admin.graphql(
    `#graphql
      mutation carrierServiceCreate($input: DeliveryCarrierServiceCreateInput!) {
        carrierServiceCreate(input: $input) {
          carrierService {
            id
            name
            callbackUrl
            active
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        input: {
          name: "Custom Shipping Rules",
          callbackUrl,
          active: true,
          supportsServiceDiscovery: true,
        },
      },
    }
  );
  
  const data = await response.json();
  return data?.data?.carrierServiceCreate?.carrierService;
}

export async function deleteCarrierService(admin: any, id: string) {
  await admin.graphql(
    `#graphql
      mutation carrierServiceDelete($id: ID!) {
        carrierServiceDelete(id: $id) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        id,
      },
    }
  );
}

export async function updateCarrierServiceUrlIfNeeded(admin: any, appUrl: string) {
  const existing = await getCarrierService(admin);
  const desiredUrl = `${appUrl}/api/shipping-rates`;
  
  if (existing) {
    if (existing.callbackUrl !== desiredUrl) {
      await admin.graphql(
        `#graphql
          mutation carrierServiceUpdate($id: ID!, $input: DeliveryCarrierServiceUpdateInput!) {
            carrierServiceUpdate(id: $id, input: $input) {
              carrierService {
                id
                callbackUrl
              }
              userErrors {
                field
                message
              }
            }
          }`,
        {
          variables: {
            id: existing.id,
            input: {
              callbackUrl: desiredUrl,
            },
          },
        }
      );
    }
    return existing.id;
  }
  
  const newService = await createCarrierService(admin, appUrl);
  return newService?.id;
}
