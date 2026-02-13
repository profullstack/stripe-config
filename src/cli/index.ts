#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { setupCommand } from './commands/setup.js';
import { productsCommand } from './commands/products.js';
import { pricesCommand } from './commands/prices.js';
import { connectCommand } from './commands/connect.js';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('stripeconf')
  .description('CLI tool for managing Stripe products, prices, and Connect accounts')
  .version(pkg.version, '-v, --version');

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