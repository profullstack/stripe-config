# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-21

### Added
- Initial release of @profullstack/stripe-config
- CLI tool with `stripeconf` command
- `stripeconf setup` - Interactive project configuration
- `stripeconf products` - Full product CRUD operations
- `stripeconf prices` - Full price management (create, read, update, archive)
- ESM module with programmatic API
- `ConfigManager` for managing multiple Stripe projects
- `StripeClient` for type-safe Stripe API operations
- `ProductManager` high-level API for products
- `PriceManager` high-level API for prices
- Secure configuration storage in `~/.config/stripeconf`
- Full TypeScript support with exported type definitions
- Comprehensive unit tests with Vitest (39 tests)
- Support for advanced product fields (metadata, images, tax codes)
- Support for recurring and one-time prices
- Support for tiered pricing models
- Multi-project configuration support
- API key validation during setup
- Beautiful CLI with inquirer, chalk, and ora
- Complete documentation and examples

### Security
- Configuration files stored with 0600 permissions (owner read/write only)
- Configuration directory with 0700 permissions (owner full access only)
- API keys never logged or displayed in error messages
- Input validation and sanitization throughout