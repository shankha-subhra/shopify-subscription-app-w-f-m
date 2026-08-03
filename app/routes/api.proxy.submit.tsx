import { type ActionFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session, admin } = await authenticate.public.appProxy(request);
    
    if (!session) {
      return json({ success: false, message: "Unauthorized request." }, { status: 401 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (error: any) {
      return json({ success: false, message: "Error parsing request JSON: " + error?.message }, { status: 400 });
    }
    
    const productId = payload.productId as string;
    const variantId = payload.variantId as string;
    const customerId = payload.customerId as string;
    const customerName = payload.customerName as string;
    const customerEmail = payload.customerEmail as string;
    const customerPhone = payload.customerPhone as string;
    const rating = parseInt(payload.rating as string, 10);
    const title = payload.title as string;
    const comment = payload.comment as string;
    const resourceUrls = payload.resourceUrls as string[]; // from AWS uploads
    
    const shopDomain = session.shop;

    if (!rating || rating < 1 || rating > 5) {
      return json({ success: false, message: "Invalid rating." }, { status: 400 });
    }
    if (!comment || comment.length < 10) {
      return json({ success: false, message: "Review comment must be at least 10 characters." }, { status: 400 });
    }
    if (!customerName || (!customerEmail && !customerId)) {
      return json({ success: false, message: "Name and email are required." }, { status: 400 });
    }

    const settings = await prisma.reviewSetting.findUnique({ where: { shop: shopDomain } });
    
    if (settings && !settings.isEnabled) {
      return json({ success: false, message: "Reviews are currently disabled." }, { status: 403 });
    }
    
    if (settings && !settings.allowGuestReviews && !customerId) {
      return json({ success: false, message: "You must be logged in to leave a review." }, { status: 403 });
    }

    let isVerifiedPurchase = false;
    let verifiedOrderId = null;
    
    if (customerId && admin) {
      try {
        const ordersResponse = await admin.graphql(
        `#graphql
        query getCustomerOrders($id: ID!) {
          customer(id: $id) {
            orders(first: 50, sortKey: CREATED_AT, reverse: true) {
              edges {
                node {
                  id
                  lineItems(first: 50) {
                    edges {
                      node {
                        product {
                          id
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
        { variables: { id: `gid://shopify/Customer/${customerId}` } }
      );
      
      const ordersJson = await ordersResponse.json();
      const orders = ordersJson.data?.customer?.orders?.edges || [];
      for (const orderEdge of orders) {
        const order = orderEdge.node;
        const lineItems = order.lineItems.edges;
        for (const lineEdge of lineItems) {
          if (lineEdge.node.product?.id === `gid://shopify/Product/${productId}`) {
            isVerifiedPurchase = true;
            verifiedOrderId = order.id;
            break;
          }
        }
        if (isVerifiedPurchase) break;
      }
      } catch (err) {
        console.error("Error verifying purchase:", err);
      }
    }

    let initialStatus = "PENDING";
    if (settings) {
      if (!settings.moderationEnabled) {
        initialStatus = "APPROVED";
      } else if (settings.autoApprove && rating === 5) {
        initialStatus = "APPROVED";
      }
    }

    const review = await prisma.productReview.create({
      data: {
        shop: shopDomain,
        productId: productId,
        variantId: variantId || null,
        customerId: customerId || null,
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone || null,
        title: title || null,
        comment: comment,
        rating: rating,
        isVerifiedPurchase: isVerifiedPurchase,
        verifiedOrderId: verifiedOrderId,
        status: initialStatus as any
      }
    });

    if (resourceUrls && resourceUrls.length > 0) {
       for (const resourceUrl of resourceUrls) {
         if (!resourceUrl) continue;
         
         const fileCreateResponse = await admin.graphql(
           `mutation fileCreate($files: [FileCreateInput!]!) {
             fileCreate(files: $files) {
               files {
                 id
                 preview { image { url } }
               }
             }
           }`,
           {
             variables: {
               files: [{ alt: "Review Image", contentType: "IMAGE", originalSource: resourceUrl }]
             }
           }
         );
         
         const fileCreateJson = await fileCreateResponse.json();
         const createdFile = fileCreateJson.data?.fileCreate?.files?.[0];
         let finalUrl = createdFile?.preview?.image?.url || resourceUrl;
         
         await prisma.productReviewImage.create({
           data: {
             reviewId: review.id,
             imageUrl: finalUrl,
             thumbnailUrl: finalUrl,
             altText: "Review Image"
           }
         });
       }
    }

    return json({ 
      success: true, 
      message: initialStatus === "APPROVED" 
        ? "Thank you! Your review has been published." 
        : "Thank you. Your review has been submitted for approval." 
    });

  } catch (error: any) {
    console.error("Failed to submit review:", error);
    if (error instanceof Response) {
      return json({ success: false, message: "Authentication failed." }, { status: error.status });
    }
    return json({ success: false, message: "An error occurred: " + (error?.message || "Unknown error") }, { status: 500 });
  }
};
