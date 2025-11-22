# Getting Started with @profullstack/stripe-config

## Quick Start

### Installation

```bash
# Install globally for CLI usage
pnpm add -g @profullstack/stripe-config

# Or install locally in your project
pnpm add @profullstack/stripe-config
```

### First Steps

1. **Configure your first Stripe project:**

```bash
stripeconf setup
```

You'll be prompted for:
- Project name (e.g., "my-app")
- Environment (test or live)
- Stripe publishable key (starts with `pk_`)
- Stripe secret key (starts with `sk_`)
- Webhook secret (optional, starts with `whsec_`)
- Default currency (e.g., "usd")

2. **Manage products:**

```bash
stripeconf products
```

Choose from:
- List all products
- View product details
- Create new product
- Update existing product
- Delete product

3. **Manage prices:**

```bash
stripeconf prices
```

Choose from:
- List all prices
- View price details
- Create new price (one-time or recurring)
- Update price
- Archive price

## Programmatic Usage

### Basic Setup

```javascript
import { ConfigManager, ProductManager, PriceManager } from '@profullstack/stripe-config';

// Load your configuration
const config = new ConfigManager();
const project = await config.getDefaultProject();

// Initialize managers
const products = new ProductManager(project);
const prices = new PriceManager(project);
```

### Creating a Product with Prices

```javascript
// Create a product
const product = await products.create({
  name: 'Pro Plan',
  description: 'Professional tier with advanced features',
  active: true,
  metadata: {
    tier: 'pro',
    support: '24/7'
  }
});

// Add a monthly price
const monthlyPrice = await prices.create({
  product: product.id,
  currency: 'usd',
  unit_amount: 4900, // $49.00
  recurring: {
    interval: 'month'
  },
  nickname: 'Pro Monthly'
});

// Add an annual price with discount
const annualPrice = await prices.create({
  product: product.id,
  currency: 'usd',
  unit_amount: 49000, // $490.00 (save $98/year)
  recurring: {
    interval: 'year'
  },
  nickname: 'Pro Annual'
});
```

### Listing Resources

```javascript
// List all products
const allProducts = await products.list({ limit: 100 });

// List only active products
const activeProducts = await products.list({ active: true });

// List prices for a specific product
const productPrices = await prices.listByProduct(product.id);

// List only recurring prices
const recurringPrices = await prices.list({ type: 'recurring' });
```

### Updating Resources

```javascript
// Update a product
await products.update('prod_123', {
  description: 'Updated description',
  active: false
});

// Update a price (limited fields)
await prices.update('price_123', {
  nickname: 'New nickname',
  active: false
});
```

## Configuration Management

### Working with Multiple Projects

```javascript
const config = new ConfigManager();

// Add a new project
await config.addProject({
  name: 'production-app',
  environment: 'live',
  publishableKey: 'pk_live_...',
  secretKey: 'sk_live_...',
  defaultCurrency: 'usd'
});

// List all projects
const projects = await config.listProjects();

// Switch between projects
const testProject = await config.getProject('test-app');
const prodProject = await config.getProject('production-app');

// Set default project
await config.setDefaultProject('production-app');
```

## Error Handling

```javascript
import { ConfigError, StripeClientError } from '@profullstack/stripe-config';

try {
  const product = await products.create({
    name: 'New Product'
  });
} catch (error) {
  if (error instanceof ConfigError) {
    console.error('Configuration error:', error.message);
  } else if (error instanceof StripeClientError) {
    console.error('Stripe API error:', error.message);
    console.error('Status code:', error.statusCode);
    console.error('Error code:', error.code);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Next Steps

- Read the [full API documentation](./API.md)
- Check out [examples](../examples/)
- Review [architecture documentation](./ARCHITECTURE.md)
- See the [project plan](./PROJECT-PLAN.md) for implementation details

## Tips

1. **Always use test mode first** - Configure a test project before working with live data
2. **Validate API keys** - The setup command validates keys automatically
3. **Use metadata** - Store custom data with products and prices for your application
4. **Archive instead of delete** - Prices cannot be deleted, only archived
5. **Check the config** - Configuration is stored in `~/.config/stripeconf/config.json`

## Troubleshooting

### "No projects configured"
Run `stripeconf setup` to configure your first project.

### "Invalid API keys"
Verify your keys in the Stripe Dashboard and ensure you're using the correct environment (test/live).

### "Permission denied"
The config directory should have 0700 permissions and the config file 0600. The tool sets these automatically.

## Support

For issues and questions:
- Check the [documentation](./README.md)
- Review [examples](../examples/)
- Open an issue on GitHub