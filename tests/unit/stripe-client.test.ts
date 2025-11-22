import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { StripeClient } from '../../src/core/stripe-client';
import { StripeClientError } from '../../src/core/types';
import type { ProjectConfig } from '../../src/core/types';

// Create mock functions
const mockProductsCreate = vi.fn();
const mockProductsRetrieve = vi.fn();
const mockProductsUpdate = vi.fn();
const mockProductsDel = vi.fn();
const mockProductsList = vi.fn();
const mockPricesCreate = vi.fn();
const mockPricesRetrieve = vi.fn();
const mockPricesUpdate = vi.fn();
const mockPricesList = vi.fn();

// Mock Stripe SDK
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      products: {
        create: mockProductsCreate,
        retrieve: mockProductsRetrieve,
        update: mockProductsUpdate,
        del: mockProductsDel,
        list: mockProductsList,
      },
      prices: {
        create: mockPricesCreate,
        retrieve: mockPricesRetrieve,
        update: mockPricesUpdate,
        list: mockPricesList,
      },
    })),
  };
});

describe('StripeClient', () => {
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

    // Clear all mocks before each test
    vi.clearAllMocks();
    
    stripeClient = new StripeClient(mockProject);
  });

  describe('initialization', () => {
    it('should create StripeClient with project config', () => {
      expect(stripeClient).toBeDefined();
      expect(stripeClient.getProject()).toEqual(mockProject);
    });
  });

  describe('products', () => {
    describe('createProduct', () => {
      it('should create a product successfully', async () => {
        const mockProduct = {
          id: 'prod_123',
          name: 'Test Product',
          description: 'Test description',
          active: true,
        };

        mockProductsCreate.mockResolvedValue(mockProduct);

        const input = {
          name: 'Test Product',
          description: 'Test description',
        };

        const result = await stripeClient.createProduct(input);

        expect(result).toEqual(mockProduct);
        expect(mockProductsCreate).toHaveBeenCalledWith(input);
      });

      it('should handle Stripe API errors', async () => {
        const stripeError = new Error('Invalid request');
        (stripeError as any).statusCode = 400;
        (stripeError as any).code = 'invalid_request_error';

        mockProductsCreate.mockRejectedValue(stripeError);

        await expect(
          stripeClient.createProduct({ name: 'Test' })
        ).rejects.toThrow(StripeClientError);
      });
    });

    describe('getProduct', () => {
      it('should retrieve a product by ID', async () => {
        const mockProduct = {
          id: 'prod_123',
          name: 'Test Product',
        };

        mockProductsRetrieve.mockResolvedValue(mockProduct);

        const result = await stripeClient.getProduct('prod_123');

        expect(result).toEqual(mockProduct);
        expect(mockProductsRetrieve).toHaveBeenCalledWith('prod_123');
      });
    });

    describe('updateProduct', () => {
      it('should update a product', async () => {
        const mockProduct = {
          id: 'prod_123',
          name: 'Updated Product',
        };

        mockProductsUpdate.mockResolvedValue(mockProduct);

        const updates = { name: 'Updated Product' };
        const result = await stripeClient.updateProduct('prod_123', updates);

        expect(result).toEqual(mockProduct);
        expect(mockProductsUpdate).toHaveBeenCalledWith('prod_123', updates);
      });
    });

    describe('deleteProduct', () => {
      it('should delete a product', async () => {
        const mockResponse = {
          id: 'prod_123',
          deleted: true,
        };

        mockProductsDel.mockResolvedValue(mockResponse);

        await stripeClient.deleteProduct('prod_123');

        expect(mockProductsDel).toHaveBeenCalledWith('prod_123');
      });
    });

    describe('listProducts', () => {
      it('should list products with default options', async () => {
        const mockResponse = {
          data: [
            { id: 'prod_1', name: 'Product 1' },
            { id: 'prod_2', name: 'Product 2' },
          ],
          has_more: false,
        };

        mockProductsList.mockResolvedValue(mockResponse);

        const result = await stripeClient.listProducts();

        expect(result).toEqual(mockResponse.data);
        expect(mockProductsList).toHaveBeenCalledWith({
          limit: 100,
        });
      });

      it('should list products with custom options', async () => {
        const mockResponse = {
          data: [{ id: 'prod_1', name: 'Product 1' }],
          has_more: true,
        };

        mockProductsList.mockResolvedValue(mockResponse);

        const options = {
          limit: 10,
          active: true,
          starting_after: 'prod_0',
        };

        const result = await stripeClient.listProducts(options);

        expect(result).toEqual(mockResponse.data);
        expect(mockProductsList).toHaveBeenCalledWith(options);
      });
    });
  });

  describe('prices', () => {
    describe('createPrice', () => {
      it('should create a one-time price', async () => {
        const mockPrice = {
          id: 'price_123',
          product: 'prod_123',
          currency: 'usd',
          unit_amount: 1000,
        };

        mockPricesCreate.mockResolvedValue(mockPrice);

        const input = {
          product: 'prod_123',
          currency: 'usd',
          unit_amount: 1000,
        };

        const result = await stripeClient.createPrice(input);

        expect(result).toEqual(mockPrice);
        expect(mockPricesCreate).toHaveBeenCalledWith(input);
      });

      it('should create a recurring price', async () => {
        const mockPrice = {
          id: 'price_123',
          product: 'prod_123',
          currency: 'usd',
          unit_amount: 1000,
          recurring: {
            interval: 'month',
            interval_count: 1,
          },
        };

        mockPricesCreate.mockResolvedValue(mockPrice);

        const input = {
          product: 'prod_123',
          currency: 'usd',
          unit_amount: 1000,
          recurring: {
            interval: 'month' as const,
            interval_count: 1,
          },
        };

        const result = await stripeClient.createPrice(input);

        expect(result).toEqual(mockPrice);
      });
    });

    describe('getPrice', () => {
      it('should retrieve a price by ID', async () => {
        const mockPrice = {
          id: 'price_123',
          product: 'prod_123',
          currency: 'usd',
          unit_amount: 1000,
        };

        mockPricesRetrieve.mockResolvedValue(mockPrice);

        const result = await stripeClient.getPrice('price_123');

        expect(result).toEqual(mockPrice);
        expect(mockPricesRetrieve).toHaveBeenCalledWith('price_123');
      });
    });

    describe('updatePrice', () => {
      it('should update a price', async () => {
        const mockPrice = {
          id: 'price_123',
          active: false,
          nickname: 'Updated Price',
        };

        mockPricesUpdate.mockResolvedValue(mockPrice);

        const updates = {
          active: false,
          nickname: 'Updated Price',
        };

        const result = await stripeClient.updatePrice('price_123', updates);

        expect(result).toEqual(mockPrice);
        expect(mockPricesUpdate).toHaveBeenCalledWith('price_123', updates);
      });
    });

    describe('listPrices', () => {
      it('should list all prices', async () => {
        const mockResponse = {
          data: [
            { id: 'price_1', product: 'prod_1' },
            { id: 'price_2', product: 'prod_2' },
          ],
          has_more: false,
        };

        mockPricesList.mockResolvedValue(mockResponse);

        const result = await stripeClient.listPrices();

        expect(result).toEqual(mockResponse.data);
        expect(mockPricesList).toHaveBeenCalledWith({
          limit: 100,
        });
      });

      it('should list prices for a specific product', async () => {
        const mockResponse = {
          data: [{ id: 'price_1', product: 'prod_123' }],
          has_more: false,
        };

        mockPricesList.mockResolvedValue(mockResponse);

        const options = {
          product: 'prod_123',
          active: true,
        };

        const result = await stripeClient.listPrices(options);

        expect(result).toEqual(mockResponse.data);
        expect(mockPricesList).toHaveBeenCalledWith({
          limit: 100,
          product: 'prod_123',
          active: true,
        });
      });
    });

    describe('archivePrice', () => {
      it('should archive a price by setting active to false', async () => {
        const mockPrice = {
          id: 'price_123',
          active: false,
        };

        mockPricesUpdate.mockResolvedValue(mockPrice);

        const result = await stripeClient.archivePrice('price_123');

        expect(result).toEqual(mockPrice);
        expect(mockPricesUpdate).toHaveBeenCalledWith('price_123', {
          active: false,
        });
      });
    });
  });

  describe('error handling', () => {
    it('should wrap Stripe errors in StripeClientError', async () => {
      const stripeError = new Error('Rate limit exceeded');
      (stripeError as any).statusCode = 429;
      (stripeError as any).code = 'rate_limit';

      mockProductsCreate.mockRejectedValue(stripeError);

      try {
        await stripeClient.createProduct({ name: 'Test' });
        expect.fail('Should have thrown StripeClientError');
      } catch (error) {
        expect(error).toBeInstanceOf(StripeClientError);
        expect((error as StripeClientError).statusCode).toBe(429);
        expect((error as StripeClientError).code).toBe('rate_limit');
      }
    });
  });
});