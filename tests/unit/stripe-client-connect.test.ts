import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StripeClient } from '../../src/core/stripe-client';
import { StripeClientError } from '../../src/core/types';
import type { ProjectConfig } from '../../src/core/types';

// Create mock functions
const mockAccountsCreate = vi.fn();
const mockAccountsRetrieve = vi.fn();
const mockAccountsList = vi.fn();
const mockAccountLinksCreate = vi.fn();
const mockWebhookEndpointsCreate = vi.fn();
const mockWebhookEndpointsList = vi.fn();
const mockWebhookEndpointsDel = vi.fn();

// Mock Stripe SDK
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      products: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
        del: vi.fn(),
        list: vi.fn(),
      },
      prices: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
        list: vi.fn(),
      },
      accounts: {
        create: mockAccountsCreate,
        retrieve: mockAccountsRetrieve,
        list: mockAccountsList,
      },
      accountLinks: {
        create: mockAccountLinksCreate,
      },
      webhookEndpoints: {
        create: mockWebhookEndpointsCreate,
        list: mockWebhookEndpointsList,
        del: mockWebhookEndpointsDel,
      },
    })),
  };
});

describe('StripeClient - Connect Operations', () => {
  let stripeClient: StripeClient;
  let mockProject: ProjectConfig;

  beforeEach(() => {
    mockProject = {
      id: 'test-id',
      name: 'test-project',
      environment: 'test',
      publishableKey: 'pk_test_123',
      secretKey: 'sk_test_123',
      defaultCurrency: 'usd',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    vi.clearAllMocks();
    stripeClient = new StripeClient(mockProject);
  });

  describe('getPlatformAccount', () => {
    it('should retrieve the platform own account', async () => {
      const mockPlatform = {
        id: 'acct_platform_123',
        country: 'US',
        email: 'platform@example.com',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        business_profile: {
          name: 'Profullstack, Inc.',
        },
      };

      mockAccountsRetrieve.mockResolvedValue(mockPlatform);

      const result = await stripeClient.getPlatformAccount();

      expect(result).toEqual(mockPlatform);
      expect(mockAccountsRetrieve).toHaveBeenCalledWith();
    });

    it('should handle invalid API key on platform retrieve', async () => {
      const stripeError = new Error('Invalid API Key provided');
      (stripeError as any).statusCode = 401;
      (stripeError as any).code = 'authentication_error';

      mockAccountsRetrieve.mockRejectedValue(stripeError);

      await expect(
        stripeClient.getPlatformAccount()
      ).rejects.toThrow(StripeClientError);
    });
  });

  describe('createConnectAccount', () => {
    it('should create an express connected account', async () => {
      const mockAccount = {
        id: 'acct_123',
        type: 'express',
        country: 'US',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      };

      mockAccountsCreate.mockResolvedValue(mockAccount);

      const input = {
        type: 'express' as const,
        country: 'US',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      };

      const result = await stripeClient.createConnectAccount(input);

      expect(result).toEqual(mockAccount);
      expect(mockAccountsCreate).toHaveBeenCalledWith(input);
    });

    it('should create a standard connected account', async () => {
      const mockAccount = {
        id: 'acct_456',
        type: 'standard',
        country: 'GB',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      };

      mockAccountsCreate.mockResolvedValue(mockAccount);

      const input = {
        type: 'standard' as const,
        country: 'GB',
        email: 'merchant@example.com',
      };

      const result = await stripeClient.createConnectAccount(input);

      expect(result).toEqual(mockAccount);
      expect(mockAccountsCreate).toHaveBeenCalledWith(input);
    });

    it('should create account with all optional fields', async () => {
      const mockAccount = {
        id: 'acct_789',
        type: 'express',
        country: 'US',
        email: 'test@example.com',
        business_type: 'company',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      };

      mockAccountsCreate.mockResolvedValue(mockAccount);

      const input = {
        type: 'express' as const,
        country: 'US',
        email: 'test@example.com',
        business_type: 'company' as const,
        metadata: { platform: 'coinpayportal' },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      };

      const result = await stripeClient.createConnectAccount(input);

      expect(result).toEqual(mockAccount);
      expect(mockAccountsCreate).toHaveBeenCalledWith(input);
    });

    it('should handle Stripe API errors on create', async () => {
      const stripeError = new Error('Connect not enabled');
      (stripeError as any).statusCode = 403;
      (stripeError as any).code = 'account_invalid';

      mockAccountsCreate.mockRejectedValue(stripeError);

      await expect(
        stripeClient.createConnectAccount({
          type: 'express',
          country: 'US',
        })
      ).rejects.toThrow(StripeClientError);
    });
  });

  describe('createAccountLink', () => {
    it('should create an onboarding link', async () => {
      const mockLink = {
        object: 'account_link',
        url: 'https://connect.stripe.com/setup/e/acct_123/abc',
        expires_at: 1700000000,
      };

      mockAccountLinksCreate.mockResolvedValue(mockLink);

      const input = {
        account: 'acct_123',
        refresh_url: 'https://example.com/reauth',
        return_url: 'https://example.com/return',
      };

      const result = await stripeClient.createAccountLink(input);

      expect(result).toEqual(mockLink);
      expect(mockAccountLinksCreate).toHaveBeenCalledWith({
        account: 'acct_123',
        refresh_url: 'https://example.com/reauth',
        return_url: 'https://example.com/return',
        type: 'account_onboarding',
      });
    });

    it('should create an account update link', async () => {
      const mockLink = {
        object: 'account_link',
        url: 'https://connect.stripe.com/setup/e/acct_123/def',
        expires_at: 1700000000,
      };

      mockAccountLinksCreate.mockResolvedValue(mockLink);

      const input = {
        account: 'acct_123',
        refresh_url: 'https://example.com/reauth',
        return_url: 'https://example.com/return',
        type: 'account_update' as const,
      };

      const result = await stripeClient.createAccountLink(input);

      expect(result).toEqual(mockLink);
      expect(mockAccountLinksCreate).toHaveBeenCalledWith({
        account: 'acct_123',
        refresh_url: 'https://example.com/reauth',
        return_url: 'https://example.com/return',
        type: 'account_update',
      });
    });

    it('should handle invalid account ID errors', async () => {
      const stripeError = new Error('No such account: acct_invalid');
      (stripeError as any).statusCode = 404;
      (stripeError as any).code = 'resource_missing';

      mockAccountLinksCreate.mockRejectedValue(stripeError);

      await expect(
        stripeClient.createAccountLink({
          account: 'acct_invalid',
          refresh_url: 'https://example.com/reauth',
          return_url: 'https://example.com/return',
        })
      ).rejects.toThrow(StripeClientError);
    });
  });

  describe('getConnectAccount', () => {
    it('should retrieve a connected account by ID', async () => {
      const mockAccount = {
        id: 'acct_123',
        type: 'express',
        country: 'US',
        email: 'merchant@example.com',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        capabilities: {
          card_payments: 'active',
          transfers: 'active',
        },
      };

      mockAccountsRetrieve.mockResolvedValue(mockAccount);

      const result = await stripeClient.getConnectAccount('acct_123');

      expect(result).toEqual(mockAccount);
      expect(mockAccountsRetrieve).toHaveBeenCalledWith('acct_123');
    });

    it('should handle non-existent account', async () => {
      const stripeError = new Error('No such account: acct_nonexistent');
      (stripeError as any).statusCode = 404;
      (stripeError as any).code = 'resource_missing';

      mockAccountsRetrieve.mockRejectedValue(stripeError);

      await expect(
        stripeClient.getConnectAccount('acct_nonexistent')
      ).rejects.toThrow(StripeClientError);
    });

    it('should return account with pending capabilities', async () => {
      const mockAccount = {
        id: 'acct_456',
        type: 'express',
        country: 'US',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        capabilities: {
          card_payments: 'pending',
          transfers: 'pending',
        },
      };

      mockAccountsRetrieve.mockResolvedValue(mockAccount);

      const result = await stripeClient.getConnectAccount('acct_456');

      expect(result.charges_enabled).toBe(false);
      expect(result.capabilities).toEqual({
        card_payments: 'pending',
        transfers: 'pending',
      });
    });
  });

  describe('listConnectAccounts', () => {
    it('should list accounts with default limit of 20', async () => {
      const mockResponse = {
        data: [
          {
            id: 'acct_1',
            type: 'express',
            country: 'US',
            charges_enabled: true,
            payouts_enabled: true,
          },
          {
            id: 'acct_2',
            type: 'standard',
            country: 'GB',
            charges_enabled: false,
            payouts_enabled: false,
          },
        ],
        has_more: false,
      };

      mockAccountsList.mockResolvedValue(mockResponse);

      const result = await stripeClient.listConnectAccounts();

      expect(result).toEqual(mockResponse.data);
      expect(mockAccountsList).toHaveBeenCalledWith({
        limit: 20,
      });
    });

    it('should list accounts with custom limit', async () => {
      const mockResponse = {
        data: [
          { id: 'acct_1', type: 'express', country: 'US' },
        ],
        has_more: true,
      };

      mockAccountsList.mockResolvedValue(mockResponse);

      const result = await stripeClient.listConnectAccounts({ limit: 5 });

      expect(result).toEqual(mockResponse.data);
      expect(mockAccountsList).toHaveBeenCalledWith({
        limit: 5,
      });
    });

    it('should support pagination with starting_after', async () => {
      const mockResponse = {
        data: [
          { id: 'acct_3', type: 'express', country: 'US' },
        ],
        has_more: false,
      };

      mockAccountsList.mockResolvedValue(mockResponse);

      const options = {
        limit: 10,
        starting_after: 'acct_2',
      };

      const result = await stripeClient.listConnectAccounts(options);

      expect(result).toEqual(mockResponse.data);
      expect(mockAccountsList).toHaveBeenCalledWith({
        limit: 10,
        starting_after: 'acct_2',
      });
    });

    it('should support pagination with ending_before', async () => {
      const mockResponse = {
        data: [
          { id: 'acct_1', type: 'express', country: 'US' },
        ],
        has_more: false,
      };

      mockAccountsList.mockResolvedValue(mockResponse);

      const options = {
        limit: 10,
        ending_before: 'acct_2',
      };

      const result = await stripeClient.listConnectAccounts(options);

      expect(result).toEqual(mockResponse.data);
      expect(mockAccountsList).toHaveBeenCalledWith({
        limit: 10,
        ending_before: 'acct_2',
      });
    });

    it('should return empty array when no accounts exist', async () => {
      const mockResponse = {
        data: [],
        has_more: false,
      };

      mockAccountsList.mockResolvedValue(mockResponse);

      const result = await stripeClient.listConnectAccounts();

      expect(result).toEqual([]);
    });

    it('should handle API errors on list', async () => {
      const stripeError = new Error('Rate limit exceeded');
      (stripeError as any).statusCode = 429;
      (stripeError as any).code = 'rate_limit';

      mockAccountsList.mockRejectedValue(stripeError);

      try {
        await stripeClient.listConnectAccounts();
        expect.fail('Should have thrown StripeClientError');
      } catch (error) {
        expect(error).toBeInstanceOf(StripeClientError);
        expect((error as StripeClientError).statusCode).toBe(429);
        expect((error as StripeClientError).code).toBe('rate_limit');
      }
    });
  });

  describe('createWebhookEndpoint', () => {
    it('should create a webhook endpoint with events', async () => {
      const mockEndpoint = {
        id: 'we_123',
        object: 'webhook_endpoint',
        url: 'https://example.com/api/stripe/webhooks',
        enabled_events: ['payment_intent.succeeded', 'checkout.session.completed'],
        secret: 'whsec_test_abc123',
        status: 'enabled',
      };

      mockWebhookEndpointsCreate.mockResolvedValue(mockEndpoint);

      const input = {
        url: 'https://example.com/api/stripe/webhooks',
        enabled_events: ['payment_intent.succeeded', 'checkout.session.completed'],
      };

      const result = await stripeClient.createWebhookEndpoint(input);

      expect(result).toEqual(mockEndpoint);
      expect(mockWebhookEndpointsCreate).toHaveBeenCalledWith({
        url: 'https://example.com/api/stripe/webhooks',
        enabled_events: ['payment_intent.succeeded', 'checkout.session.completed'],
      });
    });

    it('should create a webhook with description and metadata', async () => {
      const mockEndpoint = {
        id: 'we_456',
        object: 'webhook_endpoint',
        url: 'https://example.com/webhooks',
        enabled_events: ['*'],
        secret: 'whsec_test_def456',
        description: 'CoinPay webhook',
        metadata: { account_name: 'CoinPay' },
      };

      mockWebhookEndpointsCreate.mockResolvedValue(mockEndpoint);

      const input = {
        url: 'https://example.com/webhooks',
        enabled_events: ['*'],
        description: 'CoinPay webhook',
        metadata: { account_name: 'CoinPay' },
      };

      const result = await stripeClient.createWebhookEndpoint(input);

      expect(result).toEqual(mockEndpoint);
      expect(result.secret).toBe('whsec_test_def456');
    });

    it('should handle API errors on webhook create', async () => {
      const stripeError = new Error('Invalid URL');
      (stripeError as any).statusCode = 400;
      (stripeError as any).code = 'parameter_invalid';

      mockWebhookEndpointsCreate.mockRejectedValue(stripeError);

      await expect(
        stripeClient.createWebhookEndpoint({
          url: 'not-a-url',
          enabled_events: ['*'],
        })
      ).rejects.toThrow(StripeClientError);
    });
  });

  describe('listWebhookEndpoints', () => {
    it('should list webhook endpoints', async () => {
      const mockResponse = {
        data: [
          {
            id: 'we_123',
            url: 'https://example.com/webhooks',
            enabled_events: ['*'],
            status: 'enabled',
          },
        ],
        has_more: false,
      };

      mockWebhookEndpointsList.mockResolvedValue(mockResponse);

      const result = await stripeClient.listWebhookEndpoints();

      expect(result).toEqual(mockResponse.data);
      expect(mockWebhookEndpointsList).toHaveBeenCalledWith({ limit: 20 });
    });

    it('should list with custom limit', async () => {
      const mockResponse = { data: [], has_more: false };
      mockWebhookEndpointsList.mockResolvedValue(mockResponse);

      await stripeClient.listWebhookEndpoints({ limit: 5 });

      expect(mockWebhookEndpointsList).toHaveBeenCalledWith({ limit: 5 });
    });
  });

  describe('deleteWebhookEndpoint', () => {
    it('should delete a webhook endpoint', async () => {
      mockWebhookEndpointsDel.mockResolvedValue({ id: 'we_123', deleted: true });

      await stripeClient.deleteWebhookEndpoint('we_123');

      expect(mockWebhookEndpointsDel).toHaveBeenCalledWith('we_123');
    });

    it('should handle non-existent endpoint', async () => {
      const stripeError = new Error('No such webhook endpoint');
      (stripeError as any).statusCode = 404;
      (stripeError as any).code = 'resource_missing';

      mockWebhookEndpointsDel.mockRejectedValue(stripeError);

      await expect(
        stripeClient.deleteWebhookEndpoint('we_nonexistent')
      ).rejects.toThrow(StripeClientError);
    });
  });

  describe('error handling', () => {
    it('should wrap Connect errors in StripeClientError with status code', async () => {
      const stripeError = new Error('Invalid API key');
      (stripeError as any).statusCode = 401;
      (stripeError as any).code = 'authentication_error';

      mockAccountsCreate.mockRejectedValue(stripeError);

      try {
        await stripeClient.createConnectAccount({
          type: 'express',
          country: 'US',
        });
        expect.fail('Should have thrown StripeClientError');
      } catch (error) {
        expect(error).toBeInstanceOf(StripeClientError);
        expect((error as StripeClientError).message).toBe('Invalid API key');
        expect((error as StripeClientError).statusCode).toBe(401);
        expect((error as StripeClientError).code).toBe('authentication_error');
      }
    });

    it('should handle unknown errors gracefully', async () => {
      const unknownError = new Error();

      mockAccountsRetrieve.mockRejectedValue(unknownError);

      await expect(
        stripeClient.getConnectAccount('acct_123')
      ).rejects.toThrow(StripeClientError);
    });
  });
});
