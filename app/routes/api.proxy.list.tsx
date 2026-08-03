import { type ActionFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return json({ success: false, message: "Unauthorized request." }, { status: 401 });
    }

    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const shopDomain = session.shop;

    if (!productId) {
      return json({ success: false, message: "Product ID required." }, { status: 400 });
    }

    const reviews = await prisma.productReview.findMany({
      where: {
        shop: shopDomain,
        productId: productId,
        status: "APPROVED"
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        images: true
      }
    });

    const totalCount = reviews.length;
    let averageRating = 0;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if (totalCount > 0) {
      const sum = reviews.reduce((acc, review) => {
        const rating = review.rating;
        ratingDistribution[rating as keyof typeof ratingDistribution]++;
        return acc + rating;
      }, 0);
      averageRating = sum / totalCount;
    }

    const safeReviews = reviews.map(review => ({
      id: review.id,
      customerName: review.customerName,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: review.createdAt,
      isVerifiedPurchase: review.isVerifiedPurchase,
      merchantReply: review.merchantReply,
      images: review.images.map(img => ({
        imageUrl: img.imageUrl,
        thumbnailUrl: img.thumbnailUrl
      }))
    }));

    return json({
      success: true,
      reviews: safeReviews,
      totalCount,
      averageRating,
      ratingDistribution
    });

  } catch (error) {
    if (error instanceof Response) {
      // If Shopify throws a Response (e.g. 400 Bad Request due to HMAC failure)
      // we must catch it and return JSON so the storefront doesn't get HTML!
      return json({ success: false, message: "Authentication failed." }, { status: error.status });
    }
    return json({ success: false, message: "Server error" }, { status: 500 });
  }
};
