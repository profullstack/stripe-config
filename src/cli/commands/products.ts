import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../core/config-manager.js';
import { StripeClient } from '../../core/stripe-client.js';
import type { ProjectConfig } from '../../core/types.js';

const MANUAL_ENTRY = '__manual__';

async function pickProduct(stripeClient: StripeClient, action: string): Promise<string | null> {
  const spinner = ora('Fetching products...').start();
  try {
    const products = await stripeClient.listProducts({ limit: 100 });
    spinner.stop();

    if (products.length === 0) {
      console.log(chalk.yellow('\nNo products found.'));
      return null;
    }

    const { productId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'productId',
        message: `Select product to ${action}:`,
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

/**
 * Products command - Manage Stripe products
 */
export async function productsCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n📦 Stripe Products Management\n'));

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
        { name: 'List all products', value: 'list' },
        { name: 'View product details', value: 'get' },
        { name: 'Create new product', value: 'create' },
        { name: 'Update product', value: 'update' },
        { name: 'Delete product', value: 'delete' },
      ],
    },
  ]);

  switch (operation) {
    case 'list':
      await listProducts(stripeClient);
      break;
    case 'get':
      await getProduct(stripeClient);
      break;
    case 'create':
      await createProduct(stripeClient);
      break;
    case 'update':
      await updateProduct(stripeClient);
      break;
    case 'delete':
      await deleteProduct(stripeClient);
      break;
  }
}

async function listProducts(stripeClient: StripeClient): Promise<void> {
  const spinner = ora('Fetching products...').start();

  try {
    const products = await stripeClient.listProducts({ limit: 100 });
    spinner.stop();

    if (products.length === 0) {
      console.log(chalk.yellow('\nNo products found.'));
      return;
    }

    console.log(chalk.bold(`\nFound ${products.length} product(s):\n`));
    products.forEach((product) => {
      console.log(chalk.bold(`  ${product.name}`) + chalk.gray(` (${product.id})`));
      if (product.description) {
        console.log(chalk.gray(`    ${product.description}`));
      }
      console.log(chalk.gray(`    Active: ${product.active ? 'Yes' : 'No'}`));
      console.log();
    });
  } catch (error: any) {
    spinner.fail('Failed to fetch products');
    throw error;
  }
}

async function getProduct(stripeClient: StripeClient): Promise<void> {
  const productId = await pickProduct(stripeClient, 'view');
  if (!productId) return;

  const spinner = ora('Fetching product...').start();

  try {
    const product = await stripeClient.getProduct(productId);
    spinner.stop();

    console.log(chalk.bold('\nProduct Details:\n'));
    console.log(chalk.bold('  Name:'), product.name);
    console.log(chalk.bold('  ID:'), product.id);
    console.log(chalk.bold('  Active:'), product.active ? 'Yes' : 'No');
    if (product.description) {
      console.log(chalk.bold('  Description:'), product.description);
    }
    if (product.images && product.images.length > 0) {
      console.log(chalk.bold('  Images:'), product.images.length);
    }
    if (product.metadata && Object.keys(product.metadata).length > 0) {
      console.log(chalk.bold('  Metadata:'), JSON.stringify(product.metadata, null, 2));
    }
    console.log();
  } catch (error: any) {
    spinner.fail('Failed to fetch product');
    throw error;
  }
}

async function createProduct(stripeClient: StripeClient): Promise<void> {
  console.log(chalk.bold('\nCreate New Product\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Product name:',
      validate: (input: string) => input.trim() ? true : 'Name is required',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description (optional):',
    },
    {
      type: 'confirm',
      name: 'active',
      message: 'Active?',
      default: true,
    },
    {
      type: 'input',
      name: 'images',
      message: 'Image URLs (comma-separated, optional):',
    },
    {
      type: 'input',
      name: 'metadata',
      message: 'Metadata (JSON format, optional):',
    },
  ]);

  const spinner = ora('Creating product...').start();

  try {
    const productData: any = {
      name: answers.name,
      active: answers.active,
    };

    if (answers.description) {
      productData.description = answers.description;
    }

    if (answers.images) {
      productData.images = answers.images.split(',').map((url: string) => url.trim());
    }

    if (answers.metadata) {
      try {
        productData.metadata = JSON.parse(answers.metadata);
      } catch {
        spinner.fail('Invalid metadata JSON format');
        return;
      }
    }

    const product = await stripeClient.createProduct(productData);
    spinner.succeed('Product created successfully');

    console.log(chalk.green('\n✓ Product created!'));
    console.log(chalk.gray(`  ID: ${product.id}`));
    console.log(chalk.gray(`  Name: ${product.name}\n`));
  } catch (error: any) {
    spinner.fail('Failed to create product');
    throw error;
  }
}

async function updateProduct(stripeClient: StripeClient): Promise<void> {
  const productId = await pickProduct(stripeClient, 'update');
  if (!productId) return;

  // Fetch current product
  const spinner = ora('Fetching product...').start();
  let currentProduct;
  try {
    currentProduct = await stripeClient.getProduct(productId);
    spinner.stop();
  } catch (error: any) {
    spinner.fail('Failed to fetch product');
    throw error;
  }

  console.log(chalk.bold('\nCurrent values:\n'));
  console.log(chalk.gray(`  Name: ${currentProduct.name}`));
  console.log(chalk.gray(`  Description: ${currentProduct.description || 'None'}`));
  console.log(chalk.gray(`  Active: ${currentProduct.active}\n`));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'New name (leave empty to keep current):',
    },
    {
      type: 'input',
      name: 'description',
      message: 'New description (leave empty to keep current):',
    },
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
  ]);

  const updates: any = {};
  if (answers.name) updates.name = answers.name;
  if (answers.description) updates.description = answers.description;
  if (answers.active !== null) updates.active = answers.active;

  if (Object.keys(updates).length === 0) {
    console.log(chalk.yellow('\nNo changes made.'));
    return;
  }

  const updateSpinner = ora('Updating product...').start();

  try {
    const product = await stripeClient.updateProduct(productId, updates);
    updateSpinner.succeed('Product updated successfully');

    console.log(chalk.green('\n✓ Product updated!'));
    console.log(chalk.gray(`  ID: ${product.id}`));
    console.log(chalk.gray(`  Name: ${product.name}\n`));
  } catch (error: any) {
    updateSpinner.fail('Failed to update product');
    throw error;
  }
}

async function deleteProduct(stripeClient: StripeClient): Promise<void> {
  const productId = await pickProduct(stripeClient, 'delete');
  if (!productId) return;

  // Fetch product to show details
  const spinner = ora('Fetching product...').start();
  let product;
  try {
    product = await stripeClient.getProduct(productId);
    spinner.stop();
  } catch (error: any) {
    spinner.fail('Failed to fetch product');
    throw error;
  }

  console.log(chalk.bold('\nProduct to delete:\n'));
  console.log(chalk.gray(`  Name: ${product.name}`));
  console.log(chalk.gray(`  ID: ${product.id}\n`));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.red('Are you sure you want to delete this product?'),
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\nDeletion cancelled.'));
    return;
  }

  const deleteSpinner = ora('Deleting product...').start();

  try {
    await stripeClient.deleteProduct(productId);
    deleteSpinner.succeed('Product deleted successfully');

    console.log(chalk.green('\n✓ Product deleted!\n'));
  } catch (error: any) {
    deleteSpinner.fail('Failed to delete product');
    throw error;
  }
}
