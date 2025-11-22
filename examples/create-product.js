/**
 * Example: Creating a product with prices
 * 
 * This example demonstrates how to create a product
 * and attach prices to it using the high-level API.
 */

import { ConfigManager, ProductManager, PriceManager } from '@profullstack/stripe-config';

async function main() {
  // Load configuration
  const config = new ConfigManager();
  const project = await config.getDefaultProject();

  console.log(`Using project: ${project.name}\n`);

  // Initialize managers
  const products = new ProductManager(project);
  const prices = new PriceManager(project);

  // Create a product
  console.log('Creating product...');
  const product = await products.create({
    name: 'Premium Subscription',
    description: 'Full access to all premium features',
    active: true,
    metadata: {
      tier: 'premium',
      features: 'unlimited',
    },
  });

  console.log(`✓ Product created: ${product.id}\n`);

  // Create a monthly recurring price
  console.log('Creating monthly price...');
  const monthlyPrice = await prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: 2999, // $29.99
    recurring: {
      interval: 'month',
      interval_count: 1,
    },
    nickname: 'Monthly Premium',
  });

  console.log(`✓ Monthly price created: ${monthlyPrice.id}`);
  console.log(`  Amount: $${(monthlyPrice.unit_amount! / 100).toFixed(2)}/month\n`);

  // Create an annual recurring price with discount
  console.log('Creating annual price...');
  const annualPrice = await prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: 29900, // $299.00 (save $60/year)
    recurring: {
      interval: 'year',
      interval_count: 1,
    },
    nickname: 'Annual Premium',
  });

  console.log(`✓ Annual price created: ${annualPrice.id}`);
  console.log(`  Amount: $${(annualPrice.unit_amount / 100).toFixed(2)}/year\n`);

  // List all prices for this product
  const productPrices = await prices.listByProduct(product.id);
  console.log(`Product has ${productPrices.length} price(s)`);
}

main().catch(console.error);