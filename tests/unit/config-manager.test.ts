import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ConfigManager } from '../../src/core/config-manager';
import { ConfigError } from '../../src/core/types';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    chmod: vi.fn(),
  },
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockConfigPath = join(homedir(), '.config', 'stripeconf', 'config.json');

  beforeEach(() => {
    configManager = new ConfigManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create ConfigManager with default path', () => {
      expect(configManager).toBeDefined();
      expect(configManager.getConfigPath()).toBe(mockConfigPath);
    });

    it('should create ConfigManager with custom path', () => {
      const customPath = '/custom/path/config.json';
      const customManager = new ConfigManager(customPath);
      expect(customManager.getConfigPath()).toBe(customPath);
    });
  });

  describe('ensureConfigDirectory', () => {
    it('should create config directory if it does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.ensureConfigDirectory();

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.config/stripeconf'),
        { recursive: true }
      );
      expect(fs.chmod).toHaveBeenCalledWith(
        expect.stringContaining('.config/stripeconf'),
        0o700
      );
    });

    it('should not create directory if it already exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await configManager.ensureConfigDirectory();

      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('loadConfig', () => {
    it('should load existing config file', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [
          {
            id: 'test-id',
            name: 'test-project',
            environment: 'test' as const,
            publishableKey: 'pk_test_123',
            secretKey: 'sk_test_123',
            defaultCurrency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        defaultProject: 'test-project',
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const config = await configManager.loadConfig();

      expect(config).toEqual(mockConfig);
      expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf-8');
    });

    it('should return empty config if file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const config = await configManager.loadConfig();

      expect(config).toEqual({
        version: '1.0.0',
        projects: [],
      });
    });

    it('should throw ConfigError for invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      await expect(configManager.loadConfig()).rejects.toThrow(ConfigError);
    });
  });

  describe('saveConfig', () => {
    it('should save config to file with correct permissions', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [],
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.saveConfig(mockConfig);

      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        JSON.stringify(mockConfig, null, 2),
        'utf-8'
      );
      expect(fs.chmod).toHaveBeenCalledWith(mockConfigPath, 0o600);
    });

    it('should create directory before saving if it does not exist', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [],
      };

      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configManager.saveConfig(mockConfig);

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('addProject', () => {
    it('should add new project to config', async () => {
      const existingConfig = {
        version: '1.0.0',
        projects: [],
      };

      const newProject = {
        name: 'new-project',
        environment: 'test' as const,
        publishableKey: 'pk_test_new',
        secretKey: 'sk_test_new',
        defaultCurrency: 'usd',
      };

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify(existingConfig)
      );
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      const project = await configManager.addProject(newProject);

      expect(project.id).toBeDefined();
      expect(project.name).toBe('new-project');
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
    });

    it('should throw ConfigError if project name already exists', async () => {
      const existingConfig = {
        version: '1.0.0',
        projects: [
          {
            id: 'existing-id',
            name: 'existing-project',
            environment: 'test' as const,
            publishableKey: 'pk_test_123',
            secretKey: 'sk_test_123',
            defaultCurrency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify(existingConfig)
      );

      const newProject = {
        name: 'existing-project',
        environment: 'test' as const,
        publishableKey: 'pk_test_new',
        secretKey: 'sk_test_new',
        defaultCurrency: 'usd',
      };

      await expect(configManager.addProject(newProject)).rejects.toThrow(
        ConfigError
      );
    });

    it('should set as default project if it is the first project', async () => {
      const existingConfig = {
        version: '1.0.0',
        projects: [],
      };

      const newProject = {
        name: 'first-project',
        environment: 'test' as const,
        publishableKey: 'pk_test_first',
        secretKey: 'sk_test_first',
        defaultCurrency: 'usd',
      };

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify(existingConfig)
      );
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.addProject(newProject);

      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('"defaultProject": "first-project"'),
        'utf-8'
      );
    });
  });

  describe('getProject', () => {
    it('should return project by name', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [
          {
            id: 'test-id',
            name: 'test-project',
            environment: 'test' as const,
            publishableKey: 'pk_test_123',
            secretKey: 'sk_test_123',
            defaultCurrency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const project = await configManager.getProject('test-project');

      expect(project).toEqual(mockConfig.projects[0]);
    });

    it('should throw ConfigError if project not found', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(
        configManager.getProject('nonexistent')
      ).rejects.toThrow(ConfigError);
    });
  });

  describe('listProjects', () => {
    it('should return all projects', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [
          {
            id: 'id1',
            name: 'project1',
            environment: 'test' as const,
            publishableKey: 'pk_test_1',
            secretKey: 'sk_test_1',
            defaultCurrency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'id2',
            name: 'project2',
            environment: 'live' as const,
            publishableKey: 'pk_live_2',
            secretKey: 'sk_live_2',
            defaultCurrency: 'eur',
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const projects = await configManager.listProjects();

      expect(projects).toHaveLength(2);
      expect(projects).toEqual(mockConfig.projects);
    });
  });

  describe('updateProject', () => {
    it('should update existing project', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [
          {
            id: 'test-id',
            name: 'test-project',
            environment: 'test' as const,
            publishableKey: 'pk_test_123',
            secretKey: 'sk_test_123',
            defaultCurrency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      const updates = {
        defaultCurrency: 'eur',
        webhookSecret: 'whsec_new',
      };

      const updated = await configManager.updateProject('test-project', updates);

      expect(updated.defaultCurrency).toBe('eur');
      expect(updated.webhookSecret).toBe('whsec_new');
      expect(updated.updatedAt).not.toBe(mockConfig.projects[0].updatedAt);
    });

    it('should throw ConfigError if project not found', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(
        configManager.updateProject('nonexistent', {})
      ).rejects.toThrow(ConfigError);
    });
  });

  describe('deleteProject', () => {
    it('should delete project by name', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [
          {
            id: 'test-id',
            name: 'test-project',
            environment: 'test' as const,
            publishableKey: 'pk_test_123',
            secretKey: 'sk_test_123',
            defaultCurrency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        defaultProject: 'test-project',
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.deleteProject('test-project');

      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('"projects": []'),
        'utf-8'
      );
    });

    it('should clear default project if deleted project was default', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [
          {
            id: 'test-id',
            name: 'test-project',
            environment: 'test' as const,
            publishableKey: 'pk_test_123',
            secretKey: 'sk_test_123',
            defaultCurrency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        defaultProject: 'test-project',
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.deleteProject('test-project');

      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.not.stringContaining('"defaultProject"'),
        'utf-8'
      );
    });
  });

  describe('setDefaultProject', () => {
    it('should set default project', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [
          {
            id: 'test-id',
            name: 'test-project',
            environment: 'test' as const,
            publishableKey: 'pk_test_123',
            secretKey: 'sk_test_123',
            defaultCurrency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await configManager.setDefaultProject('test-project');

      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('"defaultProject": "test-project"'),
        'utf-8'
      );
    });

    it('should throw ConfigError if project does not exist', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(
        configManager.setDefaultProject('nonexistent')
      ).rejects.toThrow(ConfigError);
    });
  });

  describe('getDefaultProject', () => {
    it('should return default project', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [
          {
            id: 'test-id',
            name: 'test-project',
            environment: 'test' as const,
            publishableKey: 'pk_test_123',
            secretKey: 'sk_test_123',
            defaultCurrency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        defaultProject: 'test-project',
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const project = await configManager.getDefaultProject();

      expect(project).toEqual(mockConfig.projects[0]);
    });

    it('should throw ConfigError if no default project set', async () => {
      const mockConfig = {
        version: '1.0.0',
        projects: [
          {
            id: 'test-id',
            name: 'test-project',
            environment: 'test' as const,
            publishableKey: 'pk_test_123',
            secretKey: 'sk_test_123',
            defaultCurrency: 'usd',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.getDefaultProject()).rejects.toThrow(
        ConfigError
      );
    });
  });
});