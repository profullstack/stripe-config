import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../core/config-manager.js';
import { StripeClient } from '../../core/stripe-client.js';
import type { ProjectConfig } from '../../core/types.js';

/**
 * Setup command - Configure a new Stripe project
 */
export async function setupCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n🔧 Stripe Project Setup\n'));

  const configManager = new ConfigManager();

  // Prompt for project details
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Project name is required';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'environment',
      message: 'Environment:',
      choices: [
        { name: 'Test', value: 'test' },
        { name: 'Live', value: 'live' },
      ],
      default: 'test',
    },
    {
      type: 'password',
      name: 'publishableKey',
      message: 'Publishable key:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Publishable key is required';
        }
        if (!input.startsWith('pk_')) {
          return 'Invalid publishable key format (should start with pk_)';
        }
        return true;
      },
    },
    {
      type: 'password',
      name: 'secretKey',
      message: 'Secret key:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Secret key is required';
        }
        if (!input.startsWith('sk_')) {
          return 'Invalid secret key format (should start with sk_)';
        }
        return true;
      },
    },
    {
      type: 'password',
      name: 'webhookSecret',
      message: 'Webhook secret (optional):',
      validate: (input: string) => {
        if (input && !input.startsWith('whsec_')) {
          return 'Invalid webhook secret format (should start with whsec_)';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'defaultCurrency',
      message: 'Default currency:',
      default: 'usd',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Currency is required';
        }
        if (input.length !== 3) {
          return 'Currency must be a 3-letter ISO code (e.g., usd, eur)';
        }
        return true;
      },
    },
  ]);

  // Validate API keys by making a test request
  const spinner = ora('Validating API keys...').start();

  try {
    const testProject: Omit<ProjectConfig, 'id' | 'createdAt' | 'updatedAt'> = {
      name: answers.name,
      environment: answers.environment,
      publishableKey: answers.publishableKey,
      secretKey: answers.secretKey,
      webhookSecret: answers.webhookSecret || undefined,
      defaultCurrency: answers.defaultCurrency.toLowerCase(),
    };

    // Test the API key by listing products (limit 1)
    const stripeClient = new StripeClient(testProject as ProjectConfig);
    await stripeClient.listProducts({ limit: 1 });

    spinner.succeed('API keys validated successfully');

    // Save the project configuration
    const saveSpinner = ora('Saving configuration...').start();
    const project = await configManager.addProject(testProject);
    saveSpinner.succeed('Configuration saved');

    console.log(chalk.green('\n✓ Project configured successfully!'));
    console.log(chalk.gray(`  Project: ${project.name}`));
    console.log(chalk.gray(`  Environment: ${project.environment}`));
    console.log(chalk.gray(`  Currency: ${project.defaultCurrency}`));
    console.log(
      chalk.gray(`  Config: ${configManager.getConfigPath()}\n`)
    );
  } catch (error: any) {
    spinner.fail('Failed to validate API keys');
    throw new Error(
      `Invalid API keys or network error: ${error.message}`
    );
  }
}