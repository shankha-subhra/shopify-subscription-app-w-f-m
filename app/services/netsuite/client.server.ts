import { getNetSuiteAuth } from "./auth.server";

export class NetSuiteClient {
  private shop: string;

  constructor(shop: string) {
    this.shop = shop;
  }

  async get(endpoint: string, params?: Record<string, string>) {
    const auth = await getNetSuiteAuth(this.shop);
    // Execute SuiteTalk REST GET request using auth.accessToken
    console.log(`[NetSuite GET] ${endpoint}`);
    return {};
  }

  async post(endpoint: string, body: any) {
    const auth = await getNetSuiteAuth(this.shop);
    // Execute SuiteTalk REST POST request
    console.log(`[NetSuite POST] ${endpoint}`);
    return {};
  }
  
  async patch(endpoint: string, body: any) {
    // Execute SuiteTalk REST PATCH
    return {};
  }
}
