# @profullstack/stripe-config

A powerful CLI tool and ESM module for managing Stripe products and prices across multiple projects.

## Features

- 🔧 **CLI Tool** - Interactive command-line interface for managing Stripe resources
- 📦 **ESM Module** - Programmatic API for Node.js applications
- 🔐 **Secure Storage** - API keys stored in `~/.config/stripeconf` with proper permissions
- 🎯 **Multi-Project** - Manage multiple Stripe projects from a single configuration
- 💰 **Full CRUD** - Complete product and price lifecycle management
- 🔄 **Recurring Prices** - Support for subscriptions with flexible billing intervals
- 📊 **Advanced Features** - Metadata, images, tax codes, tiered pricing, and more
- 🎨 **TypeScript** - Full type definitions included

## Installation

```bash
pnpm add @profullstack/stripe-config
```

Or install globally for CLI usage:

```bash
pnpm add -g @profullstack/stripe-config
```

## CLI Usage

### Setup

Configure a new Stripe project:

```bash
stripeconf setup
```

This will prompt you for:
- Project name
- Environment (test/live)
- API keys (publishable and secret)
- Webhook secret (optional)
- Default currency

### Manage Products

```bash
stripeconf products
```

Operations available:
- List all products
- View product details
- Create new product
- Update existing product
- Delete product

### Manage Prices

```bash
stripeconf prices
```

Operations available:
- List all prices
- View price details
- Create new price (one-time or recurring)
- Update price
- Archive price

## Programmatic Usage

### Basic Example

```javascript
import { ConfigManager, StripeClient } from '@profullstack/stripe-config';

// Load configuration
const config = new ConfigManager();
const project = await config.getDefaultProject();

// Initialize Stripe client
const stripe = new StripeClient(project);

// List products
const products = await stripe.listProducts({ limit: 10 });
console.log(`Found ${products.length} products`);
```

### Using High-Level Managers

```javascript
import { ConfigManager, ProductManager, PriceManager } from '@profullstack/stripe-config';

// Load configuration
const config = new ConfigManager();
const project = await config.getDefaultProject();

// Initialize managers
const products = new ProductManager(project);
const prices = new PriceManager(project);

// Create a product
const product = await products.create({
  name: 'Premium Plan',
  description: 'Full access to all features',
  active: true,
  metadata: { tier: 'premium' }
});

// Create a recurring price
const price = await prices.create({
  product: product.id,
  currency: 'usd',
  unit_amount: 2999, // $29.99
  recurring: {
    interval: 'month',
    interval_count: 1
  }
});
```

### Managing Configuration

```javascript
import { ConfigManager } from '@profullstack/stripe-config';

const config = new ConfigManager();

// Add a new project
await config.addProject({
  name: 'my-project',
  environment: 'test',
  publishableKey: 'pk_test_...',
  secretKey: 'sk_test_...',
  defaultCurrency: 'usd'
});

// List all projects
const projects = await config.listProjects();

// Get a specific project
const project = await config.getProject('my-project');

// Set default project
await config.setDefaultProject('my-project');

// Update project
await config.updateProject('my-project', {
  defaultCurrency: 'eur'
});

// Delete project
await config.deleteProject('my-project');
```

## API Reference

### ConfigManager

Manages project configurations stored in `~/.config/stripeconf/config.json`.

```typescript
class ConfigManager {
  constructor(configPath?: string);
  
  async addProject(project: Omit<ProjectConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectConfig>;
  async getProject(name: string): Promise<ProjectConfig>;
  async listProjects(): Promise<ProjectConfig[]>;
  async updateProject(name: string, updates: Partial<ProjectConfig>): Promise<ProjectConfig>;
  async deleteProject(name: string): Promise<void>;
  async setDefaultProject(name: string): Promise<void>;
  async getDefaultProject(): Promise<ProjectConfig>;
}
```

### StripeClient

Low-level wrapper around the Stripe SDK.

```typescript
class StripeClient {
  constructor(project: ProjectConfig);
  
  // Products
  async createProduct(input: CreateProductInput): Promise<Stripe.Product>;
  async getProduct(productId: string): Promise<Stripe.Product>;
  async updateProduct(productId: string, updates: UpdateProductInput): Promise<Stripe.Product>;
  async deleteProduct(productId: string): Promise<void>;
  async listProducts(options?: ListOptions): Promise<Stripe.Product[]>;
  
  // Prices
  async createPrice(input: CreatePriceInput): Promise<Stripe.Price>;
  async getPrice(priceId: string): Promise<Stripe.Price>;
  async updatePrice(priceId: string, updates: UpdatePriceInput): Promise<Stripe.Price>;
  async listPrices(options?: PriceListOptions): Promise<Stripe.Price[]>;
  async archivePrice(priceId: string): Promise<Stripe.Price>;
}
```

### ProductManager

High-level API for product operations.

```typescript
class ProductManager {
  constructor(project: ProjectConfig);
  
  async create(input: CreateProductInput): Promise<Stripe.Product>;
  async get(productId: string): Promise<Stripe.Product>;
  async update(productId: string, updates: UpdateProductInput): Promise<Stripe.Product>;
  async delete(productId: string): Promise<void>;
  async list(options?: ListOptions): Promise<Stripe.Product[]>;
}
```

### PriceManager

High-level API for price operations.

```typescript
class PriceManager {
  constructor(project: ProjectConfig);
  
  async create(input: CreatePriceInput): Promise<Stripe.Price>;
  async get(priceId: string): Promise<Stripe.Price>;
  async update(priceId: string, updates: UpdatePriceInput): Promise<Stripe.Price>;
  async archive(priceId: string): Promise<Stripe.Price>;
  async list(options?: PriceListOptions): Promise<Stripe.Price[]>;
  async listByProduct(productId: string): Promise<Stripe.Price[]>;
}
```

## Type Definitions

All TypeScript types are exported from the main module:

```typescript
import type {
  ProjectConfig,
  Config,
  CreateProductInput,
  UpdateProductInput,
  CreatePriceInput,
  UpdatePriceInput,
  RecurringConfig,
  TierConfig,
  ListOptions,
  PriceListOptions,
} from '@profullstack/stripe-config';
```

## Configuration File

Configuration is stored in `~/.config/stripeconf/config.json`:

```json
{
  "version": "1.0.0",
  "projects": [
    {
      "id": "uuid",
      "name": "my-project",
      "environment": "test",
      "publishableKey": "pk_test_...",
      "secretKey": "sk_test_...",
      "webhookSecret": "whsec_...",
      "defaultCurrency": "usd",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "defaultProject": "my-project"
}
```

## Security

- Configuration files are stored with `0600` permissions (owner read/write only)
- Configuration directory has `0700` permissions (owner full access only)
- API keys are never logged or displayed in error messages
- All user inputs are validated before API calls

## Examples

See the [`examples/`](./examples) directory for more usage examples:

- [`basic-usage.js`](./examples/basic-usage.js) - Basic configuration and product listing
- [`create-product.js`](./examples/create-product.js) - Creating products with prices

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Build
pnpm build

# Lint
pnpm lint

# Format code
pnpm format
```

## Testing

The project uses Vitest for testing with comprehensive unit test coverage:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.