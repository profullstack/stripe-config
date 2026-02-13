import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../core/config-manager.js';
import { StripeClient } from '../../core/stripe-client.js';
import type { ProjectConfig } from '../../core/types.js';

const MANUAL_ENTRY = '__manual__';

async function pickAccount(stripeClient: StripeClient, action: string): Promise<string | null> {
  const spinner = ora('Fetching connected accounts...').start();
  try {
    const accounts = await stripeClient.listConnectAccounts({ limit: 100 });
    spinner.stop();

    if (accounts.length === 0) {
      console.log(chalk.yellow('\nNo connected accounts found.'));
      return null;
    }

    const { accountId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'accountId',
        message: `Select account to ${action}:`,
        choices: [
          ...accounts.map((a) => ({
            name: `${a.id} ${chalk.gray(`${a.type || 'unknown'} | ${a.country || '??'} | charges: ${a.charges_enabled ? 'yes' : 'no'}`)}`,
            value: a.id,
          })),
          new inquirer.Separator(),
          { name: 'Enter ID manually', value: MANUAL_ENTRY },
        ],
      },
    ]);

    if (accountId === MANUAL_ENTRY) {
      const { manualId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualId',
          message: 'Account ID:',
          validate: (input: string) => {
            if (!input.trim()) return 'Account ID is required';
            if (!input.startsWith('acct_')) return 'Account ID must start with acct_';
            return true;
          },
        },
      ]);
      return manualId;
    }

    return accountId;
  } catch (error: any) {
    spinner.fail('Failed to fetch accounts');
    throw error;
  }
}

/**
 * Inline project setup for Connect — collects API keys + org ID without
 * requiring `stripeconf setup` first.
 */
async function inlineSetup(configManager: ConfigManager): Promise<ProjectConfig> {
  console.log(chalk.bold('  No project configured yet. Let\'s set one up.\n'));

  console.log(chalk.bold.yellow('  Before you begin, make sure you have:\n'));
  console.log(chalk.white('  1. Created a Stripe account for your platform (e.g., CoinPay)'));
  console.log(chalk.gray('     Dashboard → top-left account switcher → "New account"'));
  console.log(chalk.gray('     (Skip if using your existing Stripe account)\n'));
  console.log(chalk.white('  2. Copied the API keys from that account'));
  console.log(chalk.gray('     Dashboard → Developers → API keys'));
  console.log(chalk.gray('     You need: Secret key (sk_live_...) and Publishable key (pk_live_...)\n'));
  console.log(chalk.white('  3. (Optional) Your organization ID'));
  console.log(chalk.gray('     Dashboard → Settings → Organization (org_...)\n'));

  const { ready } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'ready',
      message: 'Do you have your API keys ready?',
      default: true,
    },
  ]);

  if (!ready) {
    console.log(chalk.cyan('\n  Get your keys at: https://dashboard.stripe.com/apikeys'));
    console.log(chalk.gray('  Run this command again when you have them.\n'));
    throw new Error('Setup cancelled — API keys not ready.');
  }

  console.log();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name (e.g., CoinPay):',
      validate: (input: string) => input.trim() ? true : 'Project name is required',
    },
    {
      type: 'input',
      name: 'orgId',
      message: 'Stripe organization ID (org_... or Enter to skip):',
      validate: (input: string) => {
        if (!input.trim()) return true;
        if (!input.startsWith('org_')) return 'Org ID must start with org_';
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
      name: 'secretKey',
      message: 'Secret key (sk_live_... or sk_test_...):',
      validate: (input: string) => {
        if (!input.trim()) return 'Secret key is required';
        if (!input.startsWith('sk_')) return 'Must start with sk_ (find it at Dashboard → Developers → API keys)';
        return true;
      },
    },
    {
      type: 'password',
      name: 'publishableKey',
      message: 'Publishable key (pk_live_... or pk_test_...):',
      validate: (input: string) => {
        if (!input.trim()) return 'Publishable key is required';
        if (!input.startsWith('pk_')) return 'Must start with pk_ (find it at Dashboard → Developers → API keys)';
        return true;
      },
    },
    {
      type: 'input',
      name: 'defaultCurrency',
      message: 'Default currency:',
      default: 'usd',
      validate: (input: string) => {
        if (!input.trim()) return 'Currency is required';
        if (input.length !== 3) return 'Currency must be a 3-letter ISO code (e.g., usd, eur)';
        return true;
      },
    },
  ]);

  // Validate API keys
  const spinner = ora('Validating API keys...').start();
  try {
    const testClient = new StripeClient({
      id: '', name: '', environment: answers.environment,
      publishableKey: answers.publishableKey, secretKey: answers.secretKey,
      defaultCurrency: answers.defaultCurrency, createdAt: '', updatedAt: '',
    });
    await testClient.getPlatformAccount();
    spinner.succeed('API keys validated');
  } catch {
    spinner.fail('Invalid API keys');
    throw new Error('Could not validate API keys. Check your secret key and try again.');
  }

  const saveSpinner = ora('Saving configuration...').start();
  const project = await configManager.addProject({
    name: answers.name,
    environment: answers.environment,
    publishableKey: answers.publishableKey,
    secretKey: answers.secretKey,
    defaultCurrency: answers.defaultCurrency.toLowerCase(),
    ...(answers.orgId.trim() && { orgId: answers.orgId.trim() }),
  });
  saveSpinner.succeed('Configuration saved');

  console.log(chalk.green(`\n  ✓ Project "${project.name}" created\n`));
  return project;
}

/**
 * Connect command - Manage Stripe Connect accounts
 */
export async function connectCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n🔗 Stripe Connect Management\n'));

  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();

  // If no project exists, run inline setup (no need for `stripeconf setup`)
  let project: ProjectConfig;
  if (config.projects.length === 0) {
    project = await inlineSetup(configManager);
  } else if (config.projects.length === 1) {
    project = config.projects[0];
    console.log(chalk.gray(`Using project: ${project.name} (${project.environment})\n`));
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
        { name: 'Full platform setup (branding + webhook + env vars)', value: 'full-setup' },
        { name: 'Check Connect status', value: 'start' },
        { name: 'Create merchant account', value: 'create' },
        { name: 'Create webhook endpoint', value: 'webhook' },
        { name: 'Generate onboarding link', value: 'link' },
        { name: 'View account details', value: 'get' },
        { name: 'List merchant accounts', value: 'list' },
      ],
    },
  ]);

  switch (operation) {
    case 'start':
      await startConnect(stripeClient, project, configManager);
      break;
    case 'full-setup':
      await fullSetup(stripeClient, project, configManager);
      break;
    case 'create':
      await createAccount(stripeClient);
      break;
    case 'webhook':
      await createWebhook(stripeClient);
      break;
    case 'link':
      await createLink(stripeClient);
      break;
    case 'get':
      await getAccount(stripeClient);
      break;
    case 'list':
      await listAccounts(stripeClient);
      break;
  }
}

async function startConnect(stripeClient: StripeClient, project: ProjectConfig, configManager: ConfigManager): Promise<void> {
  console.log(chalk.bold('\n--- Stripe Connect Setup ---\n'));

  // Step 0: Prompt for org ID if not already set
  if (project.orgId) {
    console.log(chalk.gray(`  Stripe Org ID: ${project.orgId}\n`));
  } else {
    console.log(chalk.white('  To find your Stripe organization ID:'));
    console.log(chalk.white('  1. Log in to your Stripe Dashboard'));
    console.log(chalk.white('  2. Go to Settings → Organization'));
    console.log(chalk.cyan('     https://dashboard.stripe.com/settings/organization\n'));
    console.log(chalk.gray('  Your org ID looks like: org_6SNYbwPDSQupbJ7WySAFNzc\n'));

    const { orgId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'orgId',
        message: 'Stripe organization ID (paste org_... or press Enter to skip):',
        validate: (input: string) => {
          if (!input.trim()) return true;
          if (!input.startsWith('org_')) return 'Org ID must start with org_';
          return true;
        },
      },
    ]);

    if (orgId.trim()) {
      await configManager.updateProject(project.name, { orgId: orgId.trim() });
      project.orgId = orgId.trim();
      console.log(chalk.green(`  ✓ Org ID saved to project "${project.name}"\n`));
    }
  }

  // Step 1: Retrieve platform account
  const spinner = ora('Checking your Stripe platform account...').start();

  let platform;
  try {
    platform = await stripeClient.getPlatformAccount();
    spinner.succeed('Platform account found');
  } catch (error: any) {
    spinner.fail('Failed to retrieve platform account');
    console.log(chalk.red('\n  Could not access your Stripe account.'));
    console.log(chalk.yellow('  Check that your API key is correct in your project config.\n'));
    throw error;
  }

  // Step 2: Show platform details
  const businessName = platform.business_profile?.name
    || platform.settings?.dashboard?.display_name
    || 'Not set';

  console.log(chalk.bold('\n  Platform Account:\n'));
  console.log(chalk.bold('  Account ID:'), platform.id);
  console.log(chalk.bold('  Business Name:'), businessName);
  console.log(chalk.bold('  Country:'), platform.country || 'N/A');
  if (platform.email) {
    console.log(chalk.bold('  Email:'), platform.email);
  }
  console.log(chalk.bold('  Environment:'), project.environment);
  console.log(chalk.bold('  Charges Enabled:'), platform.charges_enabled ? 'Yes' : 'No');
  console.log(chalk.bold('  Payouts Enabled:'), platform.payouts_enabled ? 'Yes' : 'No');
  console.log();

  // Step 3: Check Connect readiness
  let connectReady = false;
  const checkSpinner = ora('Checking Connect access...').start();
  try {
    await stripeClient.listConnectAccounts({ limit: 1 });
    checkSpinner.succeed('Connect is enabled on this account');
    connectReady = true;
  } catch {
    checkSpinner.fail('Connect does not appear to be enabled');
  }

  if (!connectReady) {
    console.log(chalk.bold.yellow('\n  Connect is not enabled yet. Follow these steps:\n'));
    console.log(chalk.white('  1. Log in to your Stripe Dashboard:'));
    console.log(chalk.cyan('     https://dashboard.stripe.com/settings/connect\n'));
    console.log(chalk.white('  2. Click "Get started with Connect"'));
    console.log(chalk.white('  3. Choose your platform type (most common: "marketplace" or "platform")'));
    console.log(chalk.white('  4. Select the account types you want to support:'));
    console.log(chalk.gray('     - Express (recommended) — Stripe handles onboarding UI'));
    console.log(chalk.gray('     - Standard — merchants use their own Stripe Dashboard'));
    console.log(chalk.gray('     - Custom — you build the entire onboarding flow\n'));
    console.log(chalk.white('  5. Complete the platform profile (business details, branding)'));
    console.log(chalk.white('  6. Once enabled, come back and run this command again.\n'));

    const { openDashboard } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openDashboard',
        message: 'Would you like to see the Connect settings URL?',
        default: true,
      },
    ]);

    if (openDashboard) {
      const url = project.environment === 'test'
        ? 'https://dashboard.stripe.com/test/settings/connect'
        : 'https://dashboard.stripe.com/settings/connect';
      console.log(chalk.cyan(`\n  Open this URL in your browser:\n  ${url}\n`));
    }
    return;
  }

  // Step 4: Connect is enabled — show status summary
  const accountsSpinner = ora('Counting connected accounts...').start();
  let accounts: Awaited<ReturnType<typeof stripeClient.listConnectAccounts>> = [];
  try {
    accounts = await stripeClient.listConnectAccounts({ limit: 100 });
    accountsSpinner.stop();
  } catch {
    accountsSpinner.stop();
  }

  console.log(chalk.bold.green('\n  Connect is ready!\n'));
  console.log(chalk.bold('  Platform:'), businessName);
  console.log(chalk.bold('  Account ID:'), platform.id);
  if (project.orgId) {
    console.log(chalk.bold('  Org ID:'), project.orgId);
  }
  console.log(chalk.bold('  Connected Accounts:'), accounts.length);
  console.log();

  if (accounts.length === 0) {
    console.log(chalk.gray('  No connected accounts yet. You can create one with:'));
    console.log(chalk.cyan('  stripeconf connect → Create connected account\n'));
  } else {
    console.log(chalk.gray('  Recent connected accounts:'));
    accounts.slice(0, 5).forEach((a) => {
      const status = a.charges_enabled ? chalk.green('active') : chalk.yellow('pending');
      console.log(chalk.gray(`    ${a.id} (${a.type || 'unknown'}) — ${status}`));
    });
    if (accounts.length > 5) {
      console.log(chalk.gray(`    ... and ${accounts.length - 5} more`));
    }
    console.log();
  }

  // Step 5: Offer next action
  const { nextAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'nextAction',
      message: 'What would you like to do next?',
      choices: [
        { name: 'Create a connected account', value: 'create' },
        { name: 'List all connected accounts', value: 'list' },
        { name: 'Done — exit', value: 'exit' },
      ],
    },
  ]);

  switch (nextAction) {
    case 'create':
      await createAccount(stripeClient);
      break;
    case 'list':
      await listAccounts(stripeClient);
      break;
  }
}

async function fullSetup(stripeClient: StripeClient, project: ProjectConfig, configManager: ConfigManager): Promise<void> {
  console.log(chalk.bold('\n--- Stripe Connect Platform Setup ---\n'));
  console.log(chalk.gray('  This wizard configures your Stripe account as a Connect platform.'));
  console.log(chalk.gray('  Your platform account (e.g., CoinPay) is the hub that manages'));
  console.log(chalk.gray('  merchant Express accounts created via your web app.\n'));
  console.log(chalk.gray('  Prerequisites (manual, in Stripe Dashboard):'));
  console.log(chalk.gray('    1. Create a Stripe account for your platform'));
  console.log(chalk.gray('    2. Get API keys (Developers → API keys) — already done'));
  console.log(chalk.gray('    3. Enable Connect (Connect → Get started)\n'));
  console.log(chalk.gray('  This wizard handles everything else: org ID, verification,'));
  console.log(chalk.gray('  branding checklist, webhook creation, and env var output.\n'));

  // Step 1: Org ID
  console.log(chalk.bold('  Step 1: Organization ID\n'));

  if (project.orgId) {
    console.log(chalk.green(`  ✓ Org ID: ${project.orgId}\n`));
  } else {
    console.log(chalk.white('  Find your org ID at: Settings → Organization'));
    console.log(chalk.cyan('  https://dashboard.stripe.com/settings/organization\n'));

    const { orgId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'orgId',
        message: 'Stripe organization ID (org_... or press Enter to skip):',
        validate: (input: string) => {
          if (!input.trim()) return true;
          if (!input.startsWith('org_')) return 'Org ID must start with org_';
          return true;
        },
      },
    ]);

    if (orgId.trim()) {
      await configManager.updateProject(project.name, { orgId: orgId.trim() });
      project.orgId = orgId.trim();
      console.log(chalk.green(`  ✓ Org ID saved\n`));
    }
  }

  // Step 2: Verify platform account + Connect status
  console.log(chalk.bold('  Step 2: Verify Platform Account\n'));

  const platformSpinner = ora('Checking platform account...').start();
  let platform;
  try {
    platform = await stripeClient.getPlatformAccount();
    platformSpinner.succeed('Platform account verified');
  } catch (error: any) {
    platformSpinner.fail('Failed to access platform account');
    console.log(chalk.red('\n  Check your API keys in the project config.\n'));
    throw error;
  }

  const businessName = platform.business_profile?.name
    || platform.settings?.dashboard?.display_name
    || 'Not set';

  console.log(chalk.gray(`    Account: ${platform.id}`));
  console.log(chalk.gray(`    Business: ${businessName}`));
  console.log(chalk.gray(`    Country: ${platform.country || 'N/A'}`));

  // Check Connect is enabled
  const connectSpinner = ora('Checking Connect access...').start();
  let connectReady = false;
  try {
    await stripeClient.listConnectAccounts({ limit: 1 });
    connectSpinner.succeed('Connect is enabled');
    connectReady = true;
  } catch {
    connectSpinner.fail('Connect is not enabled');
  }

  if (!connectReady) {
    console.log(chalk.bold.yellow('\n  Connect must be enabled before continuing:\n'));
    console.log(chalk.white('  1. Go to Stripe Dashboard → Connect (left sidebar)'));
    console.log(chalk.white('  2. Click "Get started with Connect"'));
    console.log(chalk.white('  3. Choose platform type (marketplace or platform)'));
    console.log(chalk.white('  4. Select Express accounts (recommended)'));
    console.log(chalk.white('  5. Complete platform profile\n'));

    const dashUrl = project.environment === 'test'
      ? 'https://dashboard.stripe.com/test/settings/connect'
      : 'https://dashboard.stripe.com/settings/connect';
    console.log(chalk.cyan(`  Open: ${dashUrl}\n`));
    console.log(chalk.gray('  Run this command again after enabling Connect.\n'));
    return;
  }

  // Step 3: Platform branding guidance
  console.log(chalk.bold('\n  Step 3: Platform Branding (Dashboard)\n'));
  console.log(chalk.gray('  Configure your platform branding in the Stripe Dashboard.'));
  console.log(chalk.gray('  This is what merchants see during onboarding.\n'));

  const connectSettingsUrl = project.environment === 'test'
    ? 'https://dashboard.stripe.com/test/settings/connect'
    : 'https://dashboard.stripe.com/settings/connect';

  console.log(chalk.white('  Checklist:'));
  console.log(chalk.white('  [ ] Set platform display name (e.g., CoinPay)'));
  console.log(chalk.white('  [ ] Upload platform logo'));
  console.log(chalk.white('  [ ] Set brand color'));
  console.log(chalk.white('  [ ] Enable Express accounts'));
  console.log(chalk.white('  [ ] Set capabilities: card_payments + transfers'));
  console.log(chalk.white('  [ ] Configure payout schedule (e.g., daily, 2-day rolling)\n'));
  console.log(chalk.cyan(`  Dashboard: ${connectSettingsUrl}\n`));

  const { brandingDone } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'brandingDone',
      message: 'Have you configured platform branding? (you can do this later)',
      default: true,
    },
  ]);

  if (!brandingDone) {
    console.log(chalk.yellow('  No problem — you can configure branding anytime.\n'));
  }

  // Step 4: Create webhook endpoint
  console.log(chalk.bold('\n  Step 4: Create Webhook Endpoint\n'));

  const { webhookUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'webhookUrl',
      message: 'Webhook URL (e.g., https://yourapp.com/api/stripe/webhooks):',
      validate: (input: string) => {
        if (!input.trim()) return 'URL is required';
        try {
          new URL(input);
          return true;
        } catch {
          return 'Must be a valid URL';
        }
      },
    },
  ]);

  const { events } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'events',
      message: 'Events to listen for:',
      choices: [
        new inquirer.Separator('--- Payments ---'),
        { name: 'payment_intent.succeeded', checked: true },
        { name: 'payment_intent.payment_failed', checked: true },
        { name: 'checkout.session.completed', checked: true },
        new inquirer.Separator('--- Connect ---'),
        { name: 'account.updated', checked: true },
        new inquirer.Separator('--- Disputes & Refunds ---'),
        { name: 'charge.dispute.created', checked: true },
        { name: 'charge.dispute.closed', checked: true },
        { name: 'charge.refunded', checked: true },
        new inquirer.Separator('--- Payouts ---'),
        { name: 'payout.paid', checked: true },
        { name: 'payout.failed', checked: true },
        new inquirer.Separator('--- Subscriptions ---'),
        { name: 'customer.subscription.created', checked: false },
        { name: 'customer.subscription.updated', checked: false },
        { name: 'customer.subscription.deleted', checked: false },
        { name: 'invoice.paid', checked: false },
        { name: 'invoice.payment_failed', checked: false },
        new inquirer.Separator('---'),
        { name: 'All events (*)', value: '*' },
      ],
    },
  ]);

  const selectedEvents = events.includes('*') ? ['*'] : events;

  if (selectedEvents.length === 0) {
    console.log(chalk.yellow('  No events selected — skipping webhook creation.\n'));
  }

  let webhook;
  if (selectedEvents.length > 0) {
    const webhookSpinner = ora('Creating webhook endpoint...').start();

    try {
      webhook = await stripeClient.createWebhookEndpoint({
        url: webhookUrl,
        enabled_events: selectedEvents,
        description: `Platform webhook for ${businessName}`,
        metadata: {
          platform: businessName,
          ...(project.orgId && { org_id: project.orgId }),
        },
      });
      webhookSpinner.succeed('Webhook endpoint created');
    } catch (error: any) {
      webhookSpinner.fail('Failed to create webhook endpoint');
      throw error;
    }
  }

  // Step 5: Output env vars
  console.log(chalk.bold.green('\n  ✓ Platform Setup Complete!\n'));

  console.log(chalk.bold('  Platform Account:'));
  console.log(chalk.gray(`    Account ID: ${platform.id}`));
  console.log(chalk.gray(`    Business: ${businessName}`));
  if (project.orgId) {
    console.log(chalk.gray(`    Org ID: ${project.orgId}`));
  }

  if (webhook) {
    console.log(chalk.bold('\n  Webhook Endpoint:'));
    console.log(chalk.gray(`    ID: ${webhook.id}`));
    console.log(chalk.gray(`    URL: ${webhook.url}`));
  }

  console.log(chalk.bold.yellow('\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.yellow('  Add these to your production .env file:'));
  console.log(chalk.bold.yellow('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  console.log(`  STRIPE_SECRET_KEY=${project.secretKey}`);
  console.log(`  STRIPE_PUBLISHABLE_KEY=${project.publishableKey}`);
  console.log(`  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${project.publishableKey}`);
  if (webhook) {
    console.log(`  STRIPE_WEBHOOK_SECRET=${webhook.secret}`);
  }
  if (project.orgId) {
    console.log(`  STRIPE_ORG_ID=${project.orgId}`);
  }

  console.log(chalk.bold.yellow('\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.bold('  Next steps:'));
  console.log(chalk.white('  1. Add the env vars above to your production .env'));
  if (webhook) {
    console.log(chalk.white(`  2. Configure your app to handle webhooks at ${webhookUrl}`));
  }
  console.log(chalk.white(`  ${webhook ? '3' : '2'}. Create your first merchant account:`));
  console.log(chalk.cyan('     stripeconf connect → Create merchant account'));
  console.log(chalk.white(`  ${webhook ? '4' : '3'}. Generate an onboarding link for the merchant:`));
  console.log(chalk.cyan('     stripeconf connect → Generate onboarding link\n'));

  // Offer to create first merchant now
  const { createMerchant } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'createMerchant',
      message: 'Create your first merchant account now?',
      default: true,
    },
  ]);

  if (createMerchant) {
    await createAccount(stripeClient);
  }

  // Output JSON for scripting
  console.log(chalk.bold('\n  JSON:'));
  console.log(JSON.stringify({
    platform: {
      id: platform.id,
      business: businessName,
      country: platform.country,
      ...(project.orgId && { org_id: project.orgId }),
    },
    ...(webhook && {
      webhook: {
        id: webhook.id,
        url: webhook.url,
        secret: webhook.secret,
        events: selectedEvents,
      },
    }),
    env: {
      STRIPE_SECRET_KEY: project.secretKey,
      STRIPE_PUBLISHABLE_KEY: project.publishableKey,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: project.publishableKey,
      ...(webhook && { STRIPE_WEBHOOK_SECRET: webhook.secret }),
      ...(project.orgId && { STRIPE_ORG_ID: project.orgId }),
    },
  }, null, 2));
  console.log();
}

async function createWebhook(stripeClient: StripeClient): Promise<void> {
  console.log(chalk.bold('\nCreate Webhook Endpoint\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Webhook URL:',
      validate: (input: string) => {
        if (!input.trim()) return 'URL is required';
        try {
          new URL(input);
          return true;
        } catch {
          return 'Must be a valid URL';
        }
      },
    },
    {
      type: 'checkbox',
      name: 'events',
      message: 'Events to listen for:',
      choices: [
        new inquirer.Separator('--- Payments ---'),
        { name: 'payment_intent.succeeded', checked: true },
        { name: 'payment_intent.payment_failed', checked: true },
        { name: 'checkout.session.completed', checked: true },
        new inquirer.Separator('--- Connect ---'),
        { name: 'account.updated', checked: true },
        new inquirer.Separator('--- Disputes & Refunds ---'),
        { name: 'charge.dispute.created', checked: true },
        { name: 'charge.dispute.closed', checked: true },
        { name: 'charge.refunded', checked: true },
        new inquirer.Separator('--- Payouts ---'),
        { name: 'payout.paid', checked: true },
        { name: 'payout.failed', checked: true },
        new inquirer.Separator('--- Subscriptions ---'),
        { name: 'customer.subscription.created', checked: false },
        { name: 'customer.subscription.updated', checked: false },
        { name: 'customer.subscription.deleted', checked: false },
        { name: 'invoice.paid', checked: false },
        { name: 'invoice.payment_failed', checked: false },
        new inquirer.Separator('---'),
        { name: 'All events (*)', value: '*' },
      ],
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description (optional):',
    },
  ]);

  const events = answers.events.includes('*')
    ? ['*']
    : answers.events;

  const spinner = ora('Creating webhook endpoint...').start();

  try {
    const webhook = await stripeClient.createWebhookEndpoint({
      url: answers.url,
      enabled_events: events,
      ...(answers.description && { description: answers.description }),
    });
    spinner.succeed('Webhook endpoint created');

    console.log(chalk.green('\n✓ Webhook endpoint created!'));
    console.log(chalk.bold.yellow(`\n  STRIPE_WEBHOOK_SECRET=${webhook.secret}\n`));
    console.log(JSON.stringify({
      id: webhook.id,
      url: webhook.url,
      secret: webhook.secret,
      enabled_events: events,
    }, null, 2));
    console.log();
  } catch (error: any) {
    spinner.fail('Failed to create webhook endpoint');
    throw error;
  }
}

async function createAccount(stripeClient: StripeClient): Promise<void> {
  console.log(chalk.bold('\nCreate Connected Account\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Account type:',
      choices: [
        { name: 'Express (recommended)', value: 'express' },
        { name: 'Standard', value: 'standard' },
        { name: 'Custom', value: 'custom' },
      ],
    },
    {
      type: 'input',
      name: 'country',
      message: 'Country (2-letter code):',
      default: 'US',
      validate: (input: string) => {
        if (!input.trim()) return 'Country is required';
        if (input.trim().length !== 2) return 'Must be a 2-letter country code';
        return true;
      },
    },
    {
      type: 'input',
      name: 'email',
      message: 'Email (optional):',
    },
    {
      type: 'list',
      name: 'business_type',
      message: 'Business type:',
      choices: [
        { name: 'Individual', value: 'individual' },
        { name: 'Company', value: 'company' },
        { name: 'Non-profit', value: 'non_profit' },
        { name: 'Government entity', value: 'government_entity' },
      ],
      default: 'individual',
    },
    {
      type: 'checkbox',
      name: 'capabilities',
      message: 'Capabilities:',
      choices: [
        { name: 'Card payments', value: 'card_payments', checked: true },
        { name: 'Transfers', value: 'transfers', checked: true },
      ],
    },
    {
      type: 'input',
      name: 'metadata',
      message: 'Metadata (JSON format, optional):',
    },
  ]);

  const spinner = ora('Creating connected account...').start();

  try {
    const accountData: any = {
      type: answers.type,
      country: answers.country.toUpperCase(),
    };

    if (answers.email) {
      accountData.email = answers.email;
    }

    accountData.business_type = answers.business_type;

    if (answers.capabilities && answers.capabilities.length > 0) {
      accountData.capabilities = {};
      for (const cap of answers.capabilities) {
        accountData.capabilities[cap] = { requested: true };
      }
    }

    if (answers.metadata) {
      try {
        accountData.metadata = JSON.parse(answers.metadata);
      } catch {
        spinner.fail('Invalid metadata JSON format');
        return;
      }
    }

    const account = await stripeClient.createConnectAccount(accountData);
    spinner.succeed('Connected account created successfully');

    console.log(chalk.green('\n✓ Connected account created!'));
    console.log(JSON.stringify({
      id: account.id,
      type: account.type,
      country: account.country,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    }, null, 2));
    console.log();
  } catch (error: any) {
    spinner.fail('Failed to create connected account');
    throw error;
  }
}

async function createLink(stripeClient: StripeClient): Promise<void> {
  console.log(chalk.bold('\nGenerate Onboarding Link\n'));

  const accountId = await pickAccount(stripeClient, 'generate link for');
  if (!accountId) return;

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'refresh_url',
      message: 'Refresh URL (redirect if link expires):',
      validate: (input: string) => input.trim() ? true : 'Refresh URL is required',
    },
    {
      type: 'input',
      name: 'return_url',
      message: 'Return URL (redirect after onboarding):',
      validate: (input: string) => input.trim() ? true : 'Return URL is required',
    },
    {
      type: 'list',
      name: 'type',
      message: 'Link type:',
      choices: [
        { name: 'Account onboarding', value: 'account_onboarding' },
        { name: 'Account update', value: 'account_update' },
      ],
    },
  ]);

  const spinner = ora('Generating onboarding link...').start();

  try {
    const link = await stripeClient.createAccountLink({
      account: accountId,
      refresh_url: answers.refresh_url,
      return_url: answers.return_url,
      type: answers.type,
    });
    spinner.succeed('Onboarding link generated');

    console.log(chalk.green('\n✓ Onboarding link created!'));
    console.log(JSON.stringify({
      url: link.url,
      expires_at: link.expires_at,
    }, null, 2));
    console.log();
  } catch (error: any) {
    spinner.fail('Failed to generate onboarding link');
    throw error;
  }
}

async function getAccount(stripeClient: StripeClient): Promise<void> {
  const accountId = await pickAccount(stripeClient, 'view');
  if (!accountId) return;

  const spinner = ora('Fetching account...').start();

  try {
    const account = await stripeClient.getConnectAccount(accountId);
    spinner.stop();

    console.log(chalk.bold('\nAccount Details:\n'));
    console.log(chalk.bold('  ID:'), account.id);
    if (account.type) {
      console.log(chalk.bold('  Type:'), account.type);
    }
    console.log(chalk.bold('  Country:'), account.country || 'N/A');
    if (account.email) {
      console.log(chalk.bold('  Email:'), account.email);
    }
    console.log(chalk.bold('  Charges Enabled:'), account.charges_enabled ? 'Yes' : 'No');
    console.log(chalk.bold('  Payouts Enabled:'), account.payouts_enabled ? 'Yes' : 'No');
    console.log(chalk.bold('  Details Submitted:'), account.details_submitted ? 'Yes' : 'No');

    if (account.capabilities) {
      const caps = Object.entries(account.capabilities)
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ');
      console.log(chalk.bold('  Capabilities:'), caps);
    }

    console.log(chalk.bold('\n  JSON:'));
    console.log(JSON.stringify({
      id: account.id,
      type: account.type,
      country: account.country,
      email: account.email,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      capabilities: account.capabilities,
    }, null, 2));
    console.log();
  } catch (error: any) {
    spinner.fail('Failed to fetch account');
    throw error;
  }
}

async function listAccounts(stripeClient: StripeClient): Promise<void> {
  const { limit } = await inquirer.prompt([
    {
      type: 'number',
      name: 'limit',
      message: 'Number of accounts to list:',
      default: 20,
      validate: (input: number) => input > 0 && input <= 100 ? true : 'Must be between 1 and 100',
    },
  ]);

  const spinner = ora('Fetching connected accounts...').start();

  try {
    const accounts = await stripeClient.listConnectAccounts({ limit });
    spinner.stop();

    if (accounts.length === 0) {
      console.log(chalk.yellow('\nNo connected accounts found.'));
      return;
    }

    console.log(chalk.bold(`\nFound ${accounts.length} connected account(s):\n`));
    accounts.forEach((account) => {
      console.log(
        chalk.bold(`  ${account.id}`) +
        chalk.gray(` (${account.type || 'unknown'})`)
      );
      console.log(chalk.gray(`    Country: ${account.country || 'N/A'}`));
      console.log(chalk.gray(`    Charges: ${account.charges_enabled ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`    Payouts: ${account.payouts_enabled ? 'Yes' : 'No'}`));
      console.log();
    });

    console.log(JSON.stringify(
      accounts.map((a) => ({
        id: a.id,
        type: a.type,
        country: a.country,
        charges_enabled: a.charges_enabled,
        payouts_enabled: a.payouts_enabled,
      })),
      null,
      2,
    ));
    console.log();
  } catch (error: any) {
    spinner.fail('Failed to fetch connected accounts');
    throw error;
  }
}
