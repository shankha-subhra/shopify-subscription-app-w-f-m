import { json, type ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { calculateShippingRate } from "../services/shipping-calculator.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed" }, { status: 405 });
  }

  // Shopify sends the shop domain in the header
  const shopDomain = request.headers.get("x-shopify-shop-domain");
  
  if (!shopDomain) {
    return json({ rates: [] }); // If no shop, return empty rates
  }

  try {
    const payload = await request.json();
    const rateRequest = payload.rate;

    if (!rateRequest || !rateRequest.destination || !rateRequest.items) {
      return json({ rates: [] });
    }

    const { destination, items } = rateRequest;
    
    const cartQuantity = items.reduce((total: number, item: any) => total + Number(item.quantity || 0), 0);

    const settings = await prisma.shippingSetting.findUnique({
      where: { shop: shopDomain },
    });

    if (!settings || !settings.isEnabled) {
      return json({ rates: [] });
    }

    const rules = await prisma.shippingRule.findMany({
      where: { shop: shopDomain, isActive: true },
    });

    const destinationMapped = {
      countryCode: destination.country,
      stateCode: destination.province,
      city: destination.city,
      postalCode: destination.postal_code,
    };

    const calculatedRate = calculateShippingRate({
      cartQuantity,
      destination: destinationMapped,
      rules,
      settings,
    });

    if (!calculatedRate) {
      if (settings.fallbackEnabled && settings.fallbackPrice !== null) {
        return json({
          rates: [
            {
              service_name: "Fallback Shipping",
              service_code: "FALLBACK",
              total_price: Math.round(Number(settings.fallbackPrice) * 100).toString(),
              currency: rateRequest?.currency || settings.currency,
              description: "Standard rate",
            },
          ],
        });
      }
      return json({ rates: [] });
    }

    if (settings.loggingEnabled) {
      // Async log writing to avoid slowing down checkout response
      prisma.shippingCalculationLog.create({
        data: {
          shop: shopDomain,
          countryCode: destination.country,
          stateCode: destination.province,
          city: destination.city,
          postalCode: destination.postal_code,
          cartQuantity,
          matchedRuleId: calculatedRate.matchedRuleId,
          matchedRuleName: calculatedRate.matchedRuleName,
          calculationSource: calculatedRate.source,
          calculatedPrice: calculatedRate.price,
          currency: calculatedRate.currency,
          shippingMethodName: calculatedRate.serviceName,
          status: "SUCCESS",
        },
      }).catch(err => console.error("Error creating calculation log", err));
    }

    const checkoutCurrency = rateRequest.currency || calculatedRate.currency || "USD";

    return json({
      rates: [
        {
          service_name: calculatedRate.serviceName,
          service_code: calculatedRate.serviceCode,
          total_price: Math.round(calculatedRate.price * 100).toString(),
          currency: checkoutCurrency,
          description: "Shipping rate",
        },
      ],
    });

  } catch (error: any) {
    console.error("Error calculating shipping rates", error);

    // Try to get fallback rate if something threw an exception
    try {
      if (shopDomain) {
        const settings = await prisma.shippingSetting.findUnique({ where: { shop: shopDomain } });
        if (settings?.loggingEnabled) {
          prisma.shippingCalculationLog.create({
            data: {
              shop: shopDomain,
              cartQuantity: 0,
              calculationSource: "ERROR",
              calculatedPrice: 0,
              currency: settings.currency || "USD",
              shippingMethodName: "ERROR",
              status: "ERROR",
              errorMessage: error.message || "Unknown error",
            }
          }).catch(() => {});
        }
        if (settings?.fallbackEnabled && settings.fallbackPrice !== null) {
          return json({
            rates: [
              {
                service_name: "Fallback Shipping",
                service_code: "FALLBACK",
                total_price: Math.round(Number(settings.fallbackPrice) * 100).toString(),
                currency: settings.currency,
                description: "Standard rate",
              },
            ],
          });
        }
      }
    } catch (e) {
      // Ignore inner errors to ensure we return a response
    }

    return json({ rates: [] });
  }
}
