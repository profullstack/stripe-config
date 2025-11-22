/**
 * Basic usage example for @profullstack/stripe-config
 * 
 * This example shows how to use the ConfigManager to load
 * project configuration and perform basic operations.
 */

import { ConfigManager, StripeClient } from '@profullstack/stripe-config';

async function main() {
  // Initialize config manager
  const config = new ConfigManager();

  // Load all projects
  const projects = await config.listProjects();
  console.log(`Found ${projects.length} project(s)`);

  if (projects.length === 0) {
    console.log('No projects configured. Run "stripeconf setup" first.');
    return;
  }

  // Get the first project
  const project = projects[0];
  console.log(`Using project: ${project.name} (${project.environment})`);

  // Initialize Stripe client
  const stripe = new StripeClient(project);

  // List products
  const products = await stripe.listProducts({ limit: 5 });
  console.log(`\nFound ${products.length} product(s):`);
  products.forEach((product) => {
    console.log(`  - ${product.name} (${product.id})`);
  });
}

main().catch(console.error);