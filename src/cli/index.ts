#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { setupCommand } from './commands/setup.js';
import { productsCommand } from './commands/products.js';
import { pricesCommand } from './commands/prices.js';
import { connectCommand } from './commands/connect.js';

const program = new Command();

program
  .name('stripeconf')
  .description('CLI tool for managing Stripe products, prices, and Connect accounts')
  .version('2.0.0');

// Setup command
program
  .command('setup')
  .description('Configure a new Stripe project')
  .action(async () => {
    try {
      await setupCommand();
    } catch (error: any) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Products command
program
  .command('products')
  .description('Manage Stripe products')
  .action(async () => {
    try {
      await productsCommand();
    } catch (error: any) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Prices command
program
  .command('prices')
  .description('Manage Stripe prices')
  .action(async () => {
    try {
      await pricesCommand();
    } catch (error: any) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Connect command
program
  .command('connect')
  .description('Manage Stripe Connect accounts')
  .action(async () => {
    try {
      await connectCommand();
    } catch (error: any) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();