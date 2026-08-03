import { type ActionFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session, admin } = await authenticate.public.appProxy(request);
    
    if (!session) {
      return json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return json({ success: false, message: "Invalid payload" }, { status: 400 });
    }

    const filename = payload.filename || "image.jpg";
    const mimeType = payload.mimeType || "image/jpeg";

    const stagedUploadsResponse = await admin.graphql(
      `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters { name value }
          }
        }
      }`,
      {
        variables: {
          input: [{ filename, mimeType, httpMethod: "POST", resource: "IMAGE" }]
        }
      }
    );
    
    const stagedUploadsJson = await stagedUploadsResponse.json();
    const target = stagedUploadsJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
    
    if (!target) {
      return json({ success: false, message: "Failed to generate upload target." }, { status: 500 });
    }

    return json({ success: true, target });

  } catch (error: any) {
    console.error("Generate upload error:", error);
    if (error instanceof Response) {
      return json({ success: false, message: "Auth failed" }, { status: error.status });
    }
    return json({ success: false, message: error?.message || "Server error" }, { status: 500 });
  }
};