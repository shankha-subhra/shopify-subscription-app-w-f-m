import db from "../../db.server";

export class FakeStoreApiClient {
  private shop: string;
  private baseUrl = "https://fakestoreapi.noksha.dev/api";

  constructor(shop: string) {
    this.shop = shop;
  }

  private async fetch(endpoint: string, options?: RequestInit) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`FakeStore API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[FakeStoreApiClient] Failed to fetch ${endpoint}:`, error);
      throw error;
    }
  }

  async getProducts() {
    return this.fetch("/products");
  }

  async getUsers() {
    return this.fetch("/users");
  }

  async getCategories() {
    return this.fetch("/categories");
  }

  async getOrders() {
    return this.fetch("/orders");
  }

  async getCoupons() {
    return this.fetch("/coupons");
  }
}
