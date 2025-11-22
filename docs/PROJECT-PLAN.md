# Stripe Configuration Tool - Project Plan

## Project Overview

**Name:** `@yourorg/stripeconf`  
**CLI Command:** `stripeconf`  
**Type:** CLI Tool + ESM Module  
**Package Manager:** pnpm  
**Testing Framework:** Vitest  
**Language:** TypeScript  

## Project Goals

1. Create a CLI tool for managing Stripe products across multiple projects
2. Provide an ESM module interface for programmatic access
3. Store configuration securely in `~/.config/stripeconf`
4. Support full CRUD operations on Stripe products with advanced fields
5. Publish as a scoped npm package

## Directory Structure

```
stripe-config/
├── src/
│   ├── cli/
│   │   ├── index.ts                    # CLI entry point with commander
│   │   ├── commands/
│   │   │   ├── setup.ts                # Setup command implementation
│   │   │   └── products.ts             # Products command implementation
│   │   └── prompts/
│   │       ├── setup-prompts.ts        # Inquirer prompts for setup
│   │       └── product-prompts.ts      # Inquirer prompts for products
│   ├── core/
│   │   ├── config-manager.ts           # Configuration file management
│   │   ├── stripe-client.ts            # Stripe API wrapper
│   │   └── types.ts                    # TypeScript type definitions
│   ├── lib/
│   │   ├── products.ts                 # Product CRUD operations
│   │   ├── validators.ts               # Input validation utilities
│   │   └── formatters.ts               # Output formatting utilities
│   └── index.ts                        # ESM module main export
├── tests/
│   ├── unit/
│   │   ├── config-manager.test.ts
│   │   ├── stripe-client.test.ts
│   │   ├── products.test.ts
│   │   ├── validators.test.ts
│   │   └── formatters.test.ts
│   └── integration/
│       └── cli.test.ts
├── examples/
│   ├── basic-usage.js                  # Simple ESM usage example
│   ├── create-product.js               # Product creation example
│   ├── list-products.js                # Product listing example
│   └── advanced-usage.js               # Advanced features example
├── docs/
│   ├── ARCHITECTURE.md                 # System architecture document
│   ├── PROJECT-PLAN.md                 # This file
│   ├── API.md                          # ESM API documentation
│   ├── CLI.md                          # CLI usage documentation
│   └── diagrams/
│       ├── system-architecture.puml    # System component diagram
│       ├── setup-flow.puml             # Setup command flow
│       └── products-flow.puml          # Products command flow
├── dist/                               # Compiled output (gitignored)
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Configuration Schema

**Location:** `~/.config/stripeconf/config.json`

```json
{
  "version": "1.0.0",
  "projects": [
    {
      "id": "uuid-v4",
      "name": "my-project",
      "environment": "test",
      "publishableKey": "pk_test_...",
      "secretKey": "sk_test_...",
      "webhookSecret": "whsec_...",
      "defaultCurrency": "usd",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "defaultProject": "my-project"
}
```

## CLI Commands

### 1. Setup Command
```bash
stripeconf setup
```

**Prompts:**
- Project name (required)
- Environment (test/live)
- Publishable key (required)
- Secret key (required)
- Webhook secret (optional)
- Default currency (default: usd)

**Actions:**
- Create `~/.config/stripeconf` directory if not exists
- Set directory permissions to 0700
- Create or update `config.json`
- Set file permissions to 0600
- Validate API keys by making test request
- Set as default project if first project

### 2. Products Command
```bash
stripeconf products
```

**Flow:**
1. Load configuration
2. Prompt to select project (if multiple)
3. Prompt to select operation:
   - Create new product
   - List all products
   - Update existing product
   - Delete product

### 3. Prices Command
```bash
stripeconf prices
```

**Flow:**
1. Load configuration
2. Prompt to select project (if multiple)
3. Prompt to select operation:
   - Create new price
   - List all prices (optionally filter by product)
   - Update existing price
   - Archive price (prices cannot be deleted, only archived)

**Product Fields (Advanced):**
- **Basic:**
  - name (required)
  - description
  - active (boolean, default: true)
  
- **Pricing:**
  - Multiple price points
  - amount (in cents)
  - currency (ISO code)
  - recurring (interval, interval_count)
  - billing_scheme (per_unit, tiered)
  
- **Advanced:**
  - metadata (key-value pairs)
  - images (array of URLs)
  - tax_code (Stripe tax code)
  - unit_label (e.g., "seat", "GB")
  - statement_descriptor

## ESM Module Interface

### Core Classes

#### StripeConfig
```typescript
class StripeConfig {
  constructor(configPath?: string);
  
  // Project management
  async addProject(project: ProjectConfig): Promise<void>;
  async getProject(name: string): Promise<ProjectConfig>;
  async listProjects(): Promise<ProjectConfig[]>;
  async updateProject(name: string, updates: Partial<ProjectConfig>): Promise<void>;
  async deleteProject(name: string): Promise<void>;
  async setDefaultProject(name: string): Promise<void>;
  async getDefaultProject(): Promise<ProjectConfig>;
}
```

#### ProductManager
```typescript
class ProductManager {
  constructor(project: ProjectConfig);
  
  // CRUD operations
  async create(product: CreateProductInput): Promise<Product>;
  async list(options?: ListOptions): Promise<Product[]>;
  async get(productId: string): Promise<Product>;
  async update(productId: string, updates: UpdateProductInput): Promise<Product>;
  async delete(productId: string): Promise<void>;
  
  // Price management
  async addPrice(productId: string, price: CreatePriceInput): Promise<Price>;
  async listPrices(productId: string): Promise<Price[]>;
}
```

### Type Definitions

```typescript
interface ProjectConfig {
  id: string;
  name: string;
  environment: 'test' | 'live';
  publishableKey: string;
  secretKey: string;
  webhookSecret?: string;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateProductInput {
  name: string;
  description?: string;
  active?: boolean;
  metadata?: Record<string, string>;
  images?: string[];
  tax_code?: string;
  unit_label?: string;
  statement_descriptor?: string;
  prices?: CreatePriceInput[];
}

interface CreatePriceInput {
  product: string; // Product ID
  currency: string;
  unit_amount?: number; // Required for one-time, optional for metered
  active?: boolean;
  recurring?: {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count?: number;
    usage_type?: 'licensed' | 'metered';
    aggregate_usage?: 'sum' | 'last_during_period' | 'max';
  };
  billing_scheme?: 'per_unit' | 'tiered';
  tiers?: Array<{
    up_to: number | 'inf';
    unit_amount?: number;
    flat_amount?: number;
  }>;
  tiers_mode?: 'graduated' | 'volume';
  transform_quantity?: {
    divide_by: number;
    round: 'up' | 'down';
  };
  metadata?: Record<string, string>;
  nickname?: string;
  lookup_key?: string;
}

interface UpdatePriceInput {
  active?: boolean;
  metadata?: Record<string, string>;
  nickname?: string;
  lookup_key?: string;
  // Note: Most price fields are immutable after creation
}

interface PriceListOptions extends ListOptions {
  product?: string; // Filter by product ID
  active?: boolean;
  type?: 'one_time' | 'recurring';
  recurring?: {
    interval?: 'day' | 'week' | 'month' | 'year';
  };
}

interface UpdateProductInput {
  name?: string;
  description?: string;
  active?: boolean;
  metadata?: Record<string, string>;
  images?: string[];
  tax_code?: string;
  unit_label?: string;
  statement_descriptor?: string;
}

interface ListOptions {
  limit?: number;
  starting_after?: string;
  ending_before?: string;
  active?: boolean;
}
```

## Dependencies

### Production Dependencies
```json
{
  "stripe": "^14.0.0",
  "commander": "^11.0.0",
  "inquirer": "^9.0.0",
  "chalk": "^5.0.0",
  "ora": "^7.0.0"
}
```

### Development Dependencies
```json
{
  "typescript": "^5.3.0",
  "vitest": "^1.0.0",
  "@types/node": "^20.0.0",
  "@types/inquirer": "^9.0.0"
}
```

## Testing Strategy

### Unit Tests (Vitest)

1. **Config Manager Tests**
   - Create/read/update/delete projects
   - File system operations
   - Permission handling
   - Validation

2. **Stripe Client Tests**
   - API authentication
   - Request/response handling
   - Error handling
   - Retry logic

3. **Product Operations Tests**
   - CRUD operations
   - Field validation
   - Price management
   - Metadata handling

4. **Validators Tests**
   - Input validation
   - API key format
   - Currency codes
   - URL validation

5. **Formatters Tests**
   - Console output formatting
   - Table rendering
   - Error messages

### Integration Tests

1. **CLI Command Tests**
   - Setup command flow
   - Products command flow
   - Error scenarios
   - User input handling

### Test Coverage Goals
- Minimum 80% code coverage
- 100% coverage for critical paths (config, API calls)

## Build Configuration

### TypeScript Config
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Package.json Configuration
```json
{
  "name": "@profullstack/stripe-config",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "stripeconf": "./dist/cli/index.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "prepublishOnly": "pnpm test && pnpm build"
  }
}
```

## Security Considerations

1. **API Key Storage**
   - Store in `~/.config/stripeconf` (user directory)
   - File permissions: 0600 (read/write owner only)
   - Directory permissions: 0700 (full access owner only)
   - Never log or display keys
   - Mask in error messages

2. **Input Validation**
   - Sanitize all user inputs
   - Validate against Stripe API requirements
   - Prevent path traversal
   - Validate URLs before fetching

3. **Error Handling**
   - Don't expose sensitive data in errors
   - Provide helpful but safe error messages
   - Log errors securely

## Error Handling Strategy

### Error Types

1. **Configuration Errors**
   - Missing config file → Prompt to run setup
   - Invalid JSON → Clear parse error
   - Missing required fields → Validation error
   - Invalid API keys → Authentication error

2. **API Errors**
   - Authentication failures → Check keys message
   - Rate limiting → Retry with exponential backoff
   - Invalid requests → Detailed validation errors
   - Network errors → Retry with timeout

3. **User Input Errors**
   - Invalid format → Show expected format
   - Missing required fields → Prompt again
   - Out of range values → Show valid range

### Error Messages

- Clear and actionable
- Include suggested fixes
- Reference documentation when appropriate
- Use colors for visibility (red for errors, yellow for warnings)

## Documentation Requirements

1. **README.md**
   - Quick start guide
   - Installation instructions
   - Basic usage examples
   - Link to full documentation

2. **docs/CLI.md**
   - All CLI commands
   - Command options
   - Usage examples
   - Troubleshooting

3. **docs/API.md**
   - ESM module API reference
   - Class documentation
   - Method signatures
   - Code examples

4. **docs/ARCHITECTURE.md**
   - System design
   - Component relationships
   - Data flow
   - Reference to PlantUML diagrams

5. **examples/**
   - Working code examples
   - Common use cases
   - Best practices

## Publishing Checklist

- [ ] All tests passing
- [ ] Code coverage ≥ 80%
- [ ] Documentation complete
- [ ] Examples working
- [ ] Version number updated
- [ ] CHANGELOG.md updated
- [ ] License file included
- [ ] .npmignore configured
- [ ] Package.json metadata complete
- [ ] Scoped package name configured
- [ ] npm authentication configured

## Future Enhancements

### Phase 2
- Support for Prices resource
- Support for Customers resource
- Support for Subscriptions resource
- Bulk operations
- Export/import configurations

### Phase 3
- Configuration templates
- Webhook testing tools
- Analytics and reporting
- Multi-environment sync
- Team collaboration features

## Success Criteria

1. **Functionality**
   - All CRUD operations work correctly
   - Configuration persists properly
   - API integration is reliable
   - Error handling is robust

2. **Usability**
   - CLI is intuitive
   - Prompts are clear
   - Error messages are helpful
   - Documentation is comprehensive

3. **Quality**
   - Test coverage ≥ 80%
   - No critical bugs
   - Performance is acceptable
   - Code is maintainable

4. **Distribution**
   - Package installs correctly
   - CLI command works globally
   - ESM module imports properly
   - TypeScript types are accurate