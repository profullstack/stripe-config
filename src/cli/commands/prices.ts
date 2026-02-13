import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../core/config-manager.js';
import { StripeClient } from '../../core/stripe-client.js';
import type { ProjectConfig } from '../../core/types.js';
import type Stripe from 'stripe';

const MANUAL_ENTRY = '__manual__';

async function pickProduct(stripeClient: StripeClient, action: string): Promise<string | null> {
  const spinner = ora('Fetching products...').start();
  try {
    const products = await stripeClient.listProducts({ limit: 100 });
    spinner.stop();

    if (products.length === 0) {
      console.log(chalk.yellow('\nNo products found. Create a product first with "stripeconf products".'));
      return null;
    }

    const { productId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'productId',
        message: `Select product ${action}:`,
        choices: [
          ...products.map((p) => ({
            name: `${p.name}${p.active ? '' : chalk.gray(' (inactive)')} ${chalk.gray(p.id)}`,
            value: p.id,
          })),
          new inquirer.Separator(),
          { name: 'Enter ID manually', value: MANUAL_ENTRY },
        ],
      },
    ]);

    if (productId === MANUAL_ENTRY) {
      const { manualId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualId',
          message: 'Product ID:',
          validate: (input: string) => input.trim() ? true : 'Product ID is required',
        },
      ]);
      return manualId;
    }

    return productId;
  } catch (error: any) {
    spinner.fail('Failed to fetch products');
    throw error;
  }
}

function formatPrice(price: Stripe.Price): string {
  const amount = price.unit_amount
    ? `${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`
    : 'Metered';
  const recurring = price.recurring
    ? ` / ${price.recurring.interval_count || 1} ${price.recurring.interval}(s)`
    : ' one-time';
  const nickname = price.nickname ? ` "${price.nickname}"` : '';
  return `${amount}${recurring}${nickname}`;
}

async function pickPrice(stripeClient: StripeClient, action: string): Promise<string | null> {
  const spinner = ora('Fetching prices...').start();
  try {
    const prices = await stripeClient.listPrices({ limit: 100 });
    spinner.stop();

    if (prices.length === 0) {
      console.log(chalk.yellow('\nNo prices found.'));
      return null;
    }

    const { priceId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'priceId',
        message: `Select price to ${action}:`,
        choices: [
          ...prices.map((p) => ({
            name: `${formatPrice(p)}${p.active ? '' : chalk.gray(' (inactive)')} ${chalk.gray(p.id)}`,
            value: p.id,
          })),
          new inquirer.Separator(),
          { name: 'Enter ID manually', value: MANUAL_ENTRY },
        ],
      },
    ]);

    if (priceId === MANUAL_ENTRY) {
      const { manualId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualId',
          message: 'Price ID:',
          validate: (input: string) => input.trim() ? true : 'Price ID is required',
        },
      ]);
      return manualId;
    }

    return priceId;
  } catch (error: any) {
    spinner.fail('Failed to fetch prices');
    throw error;
  }
}

/**
 * Prices command - Manage Stripe prices
 */
export async function pricesCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n💰 Stripe Prices Management\n'));

  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();

  if (config.projects.length === 0) {
    console.log(chalk.yellow('No projects configured. Run "stripeconf setup" first.'));
    return;
  }

  // Select project
  let project: ProjectConfig;
  if (config.projects.length === 1) {
    project = config.projects[0];
    console.log(chalk.gray(`Using project: ${project.name}\n`));
  } else {
    const { selectedProject } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedProject',
        message: 'Select a project:',
        choices: config.projects.map((p: ProjectConfig) => ({
          name: `${p.name} (${p.environment})`,
          value: p.name,
        })),
      },
    ]);
    project = await configManager.getProject(selectedProject);
  }

  const stripeClient = new StripeClient(project);

  // Select operation
  const { operation } = await inquirer.prompt([
    {
      type: 'list',
      name: 'operation',
      message: 'What would you like to do?',
      choices: [
        { name: 'List all prices', value: 'list' },
        { name: 'View price details', value: 'get' },
        { name: 'Create new price', value: 'create' },
        { name: 'Update price', value: 'update' },
        { name: 'Archive price', value: 'archive' },
      ],
    },
  ]);

  switch (operation) {
    case 'list':
      await listPrices(stripeClient);
      break;
    case 'get':
      await getPrice(stripeClient);
      break;
    case 'create':
      await createPrice(stripeClient, project);
      break;
    case 'update':
      await updatePrice(stripeClient);
      break;
    case 'archive':
      await archivePrice(stripeClient);
      break;
  }
}

async function listPrices(stripeClient: StripeClient): Promise<void> {
  const { filterByProduct } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'filterByProduct',
      message: 'Filter by product?',
      default: false,
    },
  ]);

  let productId: string | undefined;
  if (filterByProduct) {
    const picked = await pickProduct(stripeClient, 'to filter by');
    if (!picked) return;
    productId = picked;
  }

  const spinner = ora('Fetching prices...').start();

  try {
    const prices = await stripeClient.listPrices(
      productId ? { product: productId, limit: 100 } : { limit: 100 }
    );
    spinner.stop();

    if (prices.length === 0) {
      console.log(chalk.yellow('\nNo prices found.'));
      return;
    }

    console.log(chalk.bold(`\nFound ${prices.length} price(s):\n`));
    prices.forEach((price) => {
      const amount = price.unit_amount
        ? `${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`
        : 'Metered';

      console.log(chalk.bold(`  ${amount}`) + chalk.gray(` (${price.id})`));
      console.log(chalk.gray(`    Product: ${price.product}`));
      console.log(chalk.gray(`    Active: ${price.active ? 'Yes' : 'No'}`));

      if (price.recurring) {
        console.log(
          chalk.gray(
            `    Recurring: ${price.recurring.interval_count || 1} ${price.recurring.interval}(s)`
          )
        );
      } else {
        console.log(chalk.gray(`    Type: One-time`));
      }

      if (price.nickname) {
        console.log(chalk.gray(`    Nickname: ${price.nickname}`));
      }
      console.log();
    });
  } catch (error: any) {
    spinner.fail('Failed to fetch prices');
    throw error;
  }
}

async function getPrice(stripeClient: StripeClient): Promise<void> {
  const priceId = await pickPrice(stripeClient, 'view');
  if (!priceId) return;

  const spinner = ora('Fetching price...').start();

  try {
    const price = await stripeClient.getPrice(priceId);
    spinner.stop();

    console.log(chalk.bold('\nPrice Details:\n'));
    console.log(chalk.bold('  ID:'), price.id);
    console.log(chalk.bold('  Product:'), price.product);
    console.log(chalk.bold('  Currency:'), price.currency.toUpperCase());

    if (price.unit_amount) {
      console.log(
        chalk.bold('  Amount:'),
        `${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`
      );
    }

    console.log(chalk.bold('  Active:'), price.active ? 'Yes' : 'No');

    if (price.recurring) {
      console.log(chalk.bold('  Type:'), 'Recurring');
      console.log(
        chalk.bold('  Interval:'),
        `${price.recurring.interval_count || 1} ${price.recurring.interval}(s)`
      );
      if (price.recurring.usage_type) {
        console.log(chalk.bold('  Usage Type:'), price.recurring.usage_type);
      }
    } else {
      console.log(chalk.bold('  Type:'), 'One-time');
    }

    if (price.nickname) {
      console.log(chalk.bold('  Nickname:'), price.nickname);
    }

    if (price.lookup_key) {
      console.log(chalk.bold('  Lookup Key:'), price.lookup_key);
    }

    if (price.metadata && Object.keys(price.metadata).length > 0) {
      console.log(chalk.bold('  Metadata:'), JSON.stringify(price.metadata, null, 2));
    }
    console.log();
  } catch (error: any) {
    spinner.fail('Failed to fetch price');
    throw error;
  }
}

async function createPrice(
  stripeClient: StripeClient,
  project: ProjectConfig
): Promise<void> {
  console.log(chalk.bold('\nCreate New Price\n'));

  // Pick product from list instead of typing ID
  const productId = await pickProduct(stripeClient, 'to add a price to');
  if (!productId) return;

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'currency',
      message: 'Currency:',
      default: project.defaultCurrency,
      validate: (input: string) => {
        if (!input.trim()) return 'Currency is required';
        if (input.length !== 3) return 'Currency must be a 3-letter ISO code';
        return true;
      },
    },
    {
      type: 'list',
      name: 'type',
      message: 'Price type:',
      choices: [
        { name: 'One-time', value: 'one_time' },
        { name: 'Recurring', value: 'recurring' },
      ],
    },
  ]);

  let recurringConfig: any = undefined;
  if (answers.type === 'recurring') {
    recurringConfig = await inquirer.prompt([
      {
        type: 'list',
        name: 'interval',
        message: 'Billing interval:',
        choices: ['day', 'week', 'month', 'year'],
      },
      {
        type: 'number',
        name: 'interval_count',
        message: 'Interval count (e.g., 1=every interval, 3=every 3 intervals):',
        default: 1,
        validate: (input: number) => input > 0 ? true : 'Must be greater than 0',
      },
      {
        type: 'list',
        name: 'usage_type',
        message: 'Usage type:',
        choices: [
          { name: 'Licensed (fixed quantity)', value: 'licensed' },
          { name: 'Metered (usage-based)', value: 'metered' },
        ],
        default: 'licensed',
      },
    ]);
  }

  const amountAnswer = await inquirer.prompt([
    {
      type: 'number',
      name: 'amount',
      message: 'Amount (in cents):',
      validate: (input: number) => {
        if (recurringConfig?.usage_type === 'metered') return true;
        return input >= 0 ? true : 'Amount must be 0 or greater';
      },
      when: () => !recurringConfig || recurringConfig.usage_type !== 'metered',
    },
    {
      type: 'input',
      name: 'nickname',
      message: 'Nickname (optional):',
    },
    {
      type: 'confirm',
      name: 'active',
      message: 'Active?',
      default: true,
    },
  ]);

  const spinner = ora('Creating price...').start();

  try {
    const priceData: any = {
      product: productId,
      currency: answers.currency.toLowerCase(),
      active: amountAnswer.active,
    };

    if (amountAnswer.amount !== undefined) {
      priceData.unit_amount = amountAnswer.amount;
    }

    if (amountAnswer.nickname) {
      priceData.nickname = amountAnswer.nickname;
    }

    if (recurringConfig) {
      priceData.recurring = {
        interval: recurringConfig.interval,
        interval_count: recurringConfig.interval_count,
        usage_type: recurringConfig.usage_type,
      };
    }

    const price = await stripeClient.createPrice(priceData);
    spinner.succeed('Price created successfully');

    console.log(chalk.green('\n✓ Price created!'));
    console.log(chalk.gray(`  ID: ${price.id}`));
    if (price.unit_amount) {
      console.log(
        chalk.gray(
          `  Amount: ${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`
        )
      );
    }
    console.log();
  } catch (error: any) {
    spinner.fail('Failed to create price');
    throw error;
  }
}

async function updatePrice(stripeClient: StripeClient): Promise<void> {
  const priceId = await pickPrice(stripeClient, 'update');
  if (!priceId) return;

  // Fetch current price
  const spinner = ora('Fetching price...').start();
  let currentPrice;
  try {
    currentPrice = await stripeClient.getPrice(priceId);
    spinner.stop();
  } catch (error: any) {
    spinner.fail('Failed to fetch price');
    throw error;
  }

  console.log(chalk.bold('\nCurrent values:\n'));
  console.log(chalk.gray(`  Active: ${currentPrice.active}`));
  console.log(chalk.gray(`  Nickname: ${currentPrice.nickname || 'None'}\n`));
  console.log(chalk.yellow('Note: Most price fields are immutable after creation.\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'active',
      message: 'Active status:',
      choices: [
        { name: 'Keep current', value: null },
        { name: 'Active', value: true },
        { name: 'Inactive', value: false },
      ],
    },
    {
      type: 'input',
      name: 'nickname',
      message: 'New nickname (leave empty to keep current):',
    },
  ]);

  const updates: any = {};
  if (answers.active !== null) updates.active = answers.active;
  if (answers.nickname) updates.nickname = answers.nickname;

  if (Object.keys(updates).length === 0) {
    console.log(chalk.yellow('\nNo changes made.'));
    return;
  }

  const updateSpinner = ora('Updating price...').start();

  try {
    const price = await stripeClient.updatePrice(priceId, updates);
    updateSpinner.succeed('Price updated successfully');

    console.log(chalk.green('\n✓ Price updated!'));
    console.log(chalk.gray(`  ID: ${price.id}\n`));
  } catch (error: any) {
    updateSpinner.fail('Failed to update price');
    throw error;
  }
}

async function archivePrice(stripeClient: StripeClient): Promise<void> {
  const priceId = await pickPrice(stripeClient, 'archive');
  if (!priceId) return;

  // Fetch price to show details
  const spinner = ora('Fetching price...').start();
  let price;
  try {
    price = await stripeClient.getPrice(priceId);
    spinner.stop();
  } catch (error: any) {
    spinner.fail('Failed to fetch price');
    throw error;
  }

  console.log(chalk.bold('\nPrice to archive:\n'));
  console.log(chalk.gray(`  ID: ${price.id}`));
  console.log(chalk.gray(`  Product: ${price.product}\n`));
  console.log(chalk.yellow('Note: Prices cannot be deleted, only archived (set to inactive).\n'));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Archive this price?',
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\nArchival cancelled.'));
    return;
  }

  const archiveSpinner = ora('Archiving price...').start();

  try {
    await stripeClient.archivePrice(priceId);
    archiveSpinner.succeed('Price archived successfully');

    console.log(chalk.green('\n✓ Price archived!\n'));
  } catch (error: any) {
    archiveSpinner.fail('Failed to archive price');
    throw error;
  }
}
