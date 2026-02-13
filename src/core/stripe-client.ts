import Stripe from 'stripe';
import type {
  ProjectConfig,
  CreateProductInput,
  UpdateProductInput,
  CreatePriceInput,
  UpdatePriceInput,
  ListOptions,
  PriceListOptions,
  CreateConnectAccountInput,
  CreateAccountLinkInput,
  ConnectListOptions,
} from './types.js';
import { StripeClientError } from './types.js';

/**
 * Wrapper around Stripe SDK for type-safe API operations
 */
export class StripeClient {
  private stripe: Stripe;
  private project: ProjectConfig;

  /**
   * Create a new StripeClient instance
   * @param project Project configuration containing API keys
   */
  constructor(project: ProjectConfig) {
    this.project = project;
    this.stripe = new Stripe(project.secretKey, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Get the current project configuration
   */
  getProject(): ProjectConfig {
    return this.project;
  }

  /**
   * Handle Stripe API errors and wrap them in StripeClientError
   */
  private handleStripeError(error: any): never {
    const message = error.message || 'Unknown Stripe API error';
    const statusCode = error.statusCode;
    const code = error.code;

    throw new StripeClientError(message, statusCode, code);
  }

  // ==================== Product Operations ====================

  /**
   * Create a new product
   */
  async createProduct(
    input: CreateProductInput
  ): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.create(input);
      return product;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * Retrieve a product by ID
   */
  async getProduct(productId: string): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.retrieve(productId);
      return product;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * Update an existing product
   */
  async updateProduct(
    productId: string,
    updates: UpdateProductInput
  ): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.update(productId, updates);
      return product;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.stripe.products.del(productId);
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * List products with optional filters
   */
  async listProducts(
    options?: ListOptions
  ): Promise<Stripe.Product[]> {
    try {
      const params: Stripe.ProductListParams = {
        limit: options?.limit || 100,
        ...(options?.starting_after && {
          starting_after: options.starting_after,
        }),
        ...(options?.ending_before && { ending_before: options.ending_before }),
        ...(options?.active !== undefined && { active: options.active }),
      };

      const response = await this.stripe.products.list(params);
      return response.data;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  // ==================== Price Operations ====================

  /**
   * Create a new price
   */
  async createPrice(
    input: CreatePriceInput
  ): Promise<Stripe.Price> {
    try {
      const price = await this.stripe.prices.create(input);
      return price;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * Retrieve a price by ID
   */
  async getPrice(priceId: string): Promise<Stripe.Price> {
    try {
      const price = await this.stripe.prices.retrieve(priceId);
      return price;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * Update an existing price
   * Note: Most price fields are immutable after creation
   */
  async updatePrice(
    priceId: string,
    updates: UpdatePriceInput
  ): Promise<Stripe.Price> {
    try {
      const price = await this.stripe.prices.update(priceId, updates);
      return price;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * List prices with optional filters
   */
  async listPrices(
    options?: PriceListOptions
  ): Promise<Stripe.Price[]> {
    try {
      const params: Stripe.PriceListParams = {
        limit: options?.limit || 100,
        ...(options?.starting_after && {
          starting_after: options.starting_after,
        }),
        ...(options?.ending_before && { ending_before: options.ending_before }),
        ...(options?.active !== undefined && { active: options.active }),
        ...(options?.product && { product: options.product }),
        ...(options?.type && { type: options.type }),
        ...(options?.recurring?.interval && {
          recurring: { interval: options.recurring.interval },
        }),
      };

      const response = await this.stripe.prices.list(params);
      return response.data;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * Archive a price (prices cannot be deleted, only archived)
   */
  async archivePrice(priceId: string): Promise<Stripe.Price> {
    return this.updatePrice(priceId, { active: false });
  }

  // ==================== Connect Operations ====================

  /**
   * Retrieve the platform's own account (no ID = your account)
   */
  async getPlatformAccount(): Promise<Stripe.Account> {
    try {
      const account = await this.stripe.accounts.retrieve();
      return account;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * Create a new connected account
   */
  async createConnectAccount(
    input: CreateConnectAccountInput
  ): Promise<Stripe.Account> {
    try {
      const account = await this.stripe.accounts.create(input);
      return account;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * Create an account onboarding or update link
   */
  async createAccountLink(
    input: CreateAccountLinkInput
  ): Promise<Stripe.AccountLink> {
    try {
      const params: Stripe.AccountLinkCreateParams = {
        account: input.account,
        refresh_url: input.refresh_url,
        return_url: input.return_url,
        type: input.type || 'account_onboarding',
      };
      const link = await this.stripe.accountLinks.create(params);
      return link;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * Retrieve a connected account by ID
   */
  async getConnectAccount(accountId: string): Promise<Stripe.Account> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      return account;
    } catch (error) {
      this.handleStripeError(error);
    }
  }

  /**
   * List connected accounts
   */
  async listConnectAccounts(
    options?: ConnectListOptions
  ): Promise<Stripe.Account[]> {
    try {
      const params: Stripe.AccountListParams = {
        limit: options?.limit || 20,
        ...(options?.starting_after && {
          starting_after: options.starting_after,
        }),
        ...(options?.ending_before && { ending_before: options.ending_before }),
      };

      const response = await this.stripe.accounts.list(params);
      return response.data;
    } catch (error) {
      this.handleStripeError(error);
    }
  }
}