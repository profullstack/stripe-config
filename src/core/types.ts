/**
 * Core type definitions for the Stripe configuration tool
 */

/**
 * Project configuration stored in ~/.config/stripeconf/config.json
 */
export interface ProjectConfig {
  /** Unique identifier for the project */
  id: string;
  /** Human-readable project name */
  name: string;
  /** Stripe environment (test or live) */
  environment: 'test' | 'live';
  /** Stripe publishable key */
  publishableKey: string;
  /** Stripe secret key */
  secretKey: string;
  /** Optional webhook secret for event verification */
  webhookSecret?: string;
  /** Default currency for the project (ISO 4217 code) */
  defaultCurrency: string;
  /** Timestamp when project was created */
  createdAt: string;
  /** Timestamp when project was last updated */
  updatedAt: string;
}

/**
 * Root configuration file structure
 */
export interface Config {
  /** Configuration file version */
  version: string;
  /** List of configured projects */
  projects: ProjectConfig[];
  /** Name of the default project to use */
  defaultProject?: string;
}

/**
 * Input for creating a new product
 */
export interface CreateProductInput {
  /** Product name (required) */
  name: string;
  /** Product description */
  description?: string;
  /** Whether the product is active */
  active?: boolean;
  /** Custom metadata key-value pairs */
  metadata?: Record<string, string>;
  /** Array of image URLs */
  images?: string[];
  /** Stripe tax code */
  tax_code?: string;
  /** Unit label (e.g., "seat", "GB") */
  unit_label?: string;
  /** Statement descriptor for card statements */
  statement_descriptor?: string;
}

/**
 * Input for updating an existing product
 */
export interface UpdateProductInput {
  /** Product name */
  name?: string;
  /** Product description */
  description?: string;
  /** Whether the product is active */
  active?: boolean;
  /** Custom metadata key-value pairs */
  metadata?: Record<string, string>;
  /** Array of image URLs */
  images?: string[];
  /** Stripe tax code */
  tax_code?: string;
  /** Unit label */
  unit_label?: string;
  /** Statement descriptor */
  statement_descriptor?: string;
}

/**
 * Recurring price configuration
 */
export interface RecurringConfig {
  /** Billing interval */
  interval: 'day' | 'week' | 'month' | 'year';
  /** Number of intervals between billings */
  interval_count?: number;
  /** Usage type for metered billing */
  usage_type?: 'licensed' | 'metered';
  /** How to aggregate usage for metered billing */
  aggregate_usage?: 'sum' | 'last_during_period' | 'max';
}

/**
 * Tiered pricing configuration
 */
export interface TierConfig {
  /** Upper bound of this tier (use 'inf' for unlimited) */
  up_to: number | 'inf';
  /** Price per unit in this tier */
  unit_amount?: number;
  /** Flat fee for this tier */
  flat_amount?: number;
}

/**
 * Quantity transformation configuration
 */
export interface TransformQuantityConfig {
  /** Divide quantity by this number */
  divide_by: number;
  /** Rounding strategy */
  round: 'up' | 'down';
}

/**
 * Input for creating a new price
 */
export interface CreatePriceInput {
  /** Product ID this price belongs to */
  product: string;
  /** Currency (ISO 4217 code) */
  currency: string;
  /** Price amount in cents (required for one-time, optional for metered) */
  unit_amount?: number;
  /** Whether the price is active */
  active?: boolean;
  /** Recurring billing configuration */
  recurring?: RecurringConfig;
  /** Billing scheme */
  billing_scheme?: 'per_unit' | 'tiered';
  /** Tiered pricing configuration */
  tiers?: TierConfig[];
  /** Tiers mode */
  tiers_mode?: 'graduated' | 'volume';
  /** Quantity transformation */
  transform_quantity?: TransformQuantityConfig;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Internal nickname */
  nickname?: string;
  /** Lookup key for API references */
  lookup_key?: string;
}

/**
 * Input for updating an existing price
 * Note: Most price fields are immutable after creation
 */
export interface UpdatePriceInput {
  /** Whether the price is active */
  active?: boolean;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Internal nickname */
  nickname?: string;
  /** Lookup key */
  lookup_key?: string;
}

/**
 * Input for creating a Stripe Connect account
 */
export interface CreateConnectAccountInput {
  /** Account type */
  type: 'express' | 'standard' | 'custom';
  /** Two-letter country code */
  country: string;
  /** Account email */
  email?: string;
  /** Business type */
  business_type?: 'individual' | 'company' | 'non_profit' | 'government_entity';
  /** Custom metadata key-value pairs */
  metadata?: Record<string, string>;
  /** Requested capabilities */
  capabilities?: {
    card_payments?: { requested: boolean };
    transfers?: { requested: boolean };
  };
}

/**
 * Input for creating an account onboarding link
 */
export interface CreateAccountLinkInput {
  /** Connected account ID */
  account: string;
  /** URL to redirect if the link expires */
  refresh_url: string;
  /** URL to redirect after onboarding */
  return_url: string;
  /** Link type */
  type?: 'account_onboarding' | 'account_update';
}

/**
 * Options for listing connected accounts
 */
export interface ConnectListOptions {
  /** Maximum number of items to return */
  limit?: number;
  /** Cursor for pagination (ID to start after) */
  starting_after?: string;
  /** Cursor for pagination (ID to end before) */
  ending_before?: string;
}

/**
 * Options for listing resources
 */
export interface ListOptions {
  /** Maximum number of items to return */
  limit?: number;
  /** Cursor for pagination (ID to start after) */
  starting_after?: string;
  /** Cursor for pagination (ID to end before) */
  ending_before?: string;
  /** Filter by active status */
  active?: boolean;
}

/**
 * Options for listing prices
 */
export interface PriceListOptions extends ListOptions {
  /** Filter by product ID */
  product?: string;
  /** Filter by price type */
  type?: 'one_time' | 'recurring';
  /** Filter by recurring interval */
  recurring?: {
    interval?: 'day' | 'week' | 'month' | 'year';
  };
}

/**
 * Custom error class for configuration errors
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Custom error class for Stripe API errors
 */
export class StripeClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'StripeClientError';
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}