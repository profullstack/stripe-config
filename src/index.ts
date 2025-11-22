/**
 * @profullstack/stripe-config
 * 
 * ESM module for programmatic access to Stripe configuration and management
 */

// Export core classes
export { ConfigManager } from './core/config-manager.js';
export { StripeClient } from './core/stripe-client.js';

// Export all types
export type {
  ProjectConfig,
  Config,
  CreateProductInput,
  UpdateProductInput,
  CreatePriceInput,
  UpdatePriceInput,
  RecurringConfig,
  TierConfig,
  TransformQuantityConfig,
  ListOptions,
  PriceListOptions,
} from './core/types.js';

// Export custom errors
export { ConfigError, StripeClientError, ValidationError } from './core/types.js';

/**
 * Product Manager - High-level API for product operations
 */
export class ProductManager {
  private stripeClient: StripeClient;

  constructor(project: ProjectConfig) {
    this.stripeClient = new StripeClient(project);
  }

  /**
   * Create a new product
   */
  async create(input: CreateProductInput) {
    return this.stripeClient.createProduct(input);
  }

  /**
   * Get a product by ID
   */
  async get(productId: string) {
    return this.stripeClient.getProduct(productId);
  }

  /**
   * Update a product
   */
  async update(productId: string, updates: UpdateProductInput) {
    return this.stripeClient.updateProduct(productId, updates);
  }

  /**
   * Delete a product
   */
  async delete(productId: string) {
    return this.stripeClient.deleteProduct(productId);
  }

  /**
   * List products
   */
  async list(options?: ListOptions) {
    return this.stripeClient.listProducts(options);
  }
}

/**
 * Price Manager - High-level API for price operations
 */
export class PriceManager {
  private stripeClient: StripeClient;

  constructor(project: ProjectConfig) {
    this.stripeClient = new StripeClient(project);
  }

  /**
   * Create a new price
   */
  async create(input: CreatePriceInput) {
    return this.stripeClient.createPrice(input);
  }

  /**
   * Get a price by ID
   */
  async get(priceId: string) {
    return this.stripeClient.getPrice(priceId);
  }

  /**
   * Update a price
   */
  async update(priceId: string, updates: UpdatePriceInput) {
    return this.stripeClient.updatePrice(priceId, updates);
  }

  /**
   * Archive a price (set to inactive)
   */
  async archive(priceId: string) {
    return this.stripeClient.archivePrice(priceId);
  }

  /**
   * List prices
   */
  async list(options?: PriceListOptions) {
    return this.stripeClient.listPrices(options);
  }

  /**
   * List prices for a specific product
   */
  async listByProduct(productId: string) {
    return this.stripeClient.listPrices({ product: productId });
  }
}

// Re-import types for the managers
import type { ProjectConfig, CreateProductInput, UpdateProductInput, CreatePriceInput, UpdatePriceInput, ListOptions, PriceListOptions } from './core/types.js';
import { StripeClient } from './core/stripe-client.js';