import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import type { Config, ProjectConfig } from './types';
import { ConfigError } from './types';

/**
 * Manages configuration file operations for Stripe projects
 * Stores configuration in ~/.config/stripeconf/config.json
 */
export class ConfigManager {
  private configPath: string;
  private readonly CONFIG_VERSION = '1.0.0';

  /**
   * Create a new ConfigManager instance
   * @param configPath Optional custom path for config file
   */
  constructor(configPath?: string) {
    this.configPath =
      configPath || join(homedir(), '.config', 'stripeconf', 'config.json');
  }

  /**
   * Get the current config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Ensure the config directory exists with proper permissions
   */
  async ensureConfigDirectory(): Promise<void> {
    const configDir = dirname(this.configPath);

    try {
      await fs.access(configDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(configDir, { recursive: true });
      // Set directory permissions to 0700 (owner read/write/execute only)
      await fs.chmod(configDir, 0o700);
    }
  }

  /**
   * Load configuration from file
   * Returns empty config if file doesn't exist
   */
  async loadConfig(): Promise<Config> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(data) as Config;
      return config;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty config
        return {
          version: this.CONFIG_VERSION,
          projects: [],
        };
      }

      if (error instanceof SyntaxError) {
        throw new ConfigError(
          `Invalid JSON in config file: ${this.configPath}`
        );
      }

      throw new ConfigError(
        `Failed to load config: ${error.message}`
      );
    }
  }

  /**
   * Save configuration to file with proper permissions
   */
  async saveConfig(config: Config): Promise<void> {
    try {
      await this.ensureConfigDirectory();

      const data = JSON.stringify(config, null, 2);
      await fs.writeFile(this.configPath, data, 'utf-8');

      // Set file permissions to 0600 (owner read/write only)
      await fs.chmod(this.configPath, 0o600);
    } catch (error: any) {
      throw new ConfigError(
        `Failed to save config: ${error.message}`
      );
    }
  }

  /**
   * Add a new project to the configuration
   */
  async addProject(
    projectInput: Omit<ProjectConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ProjectConfig> {
    const config = await this.loadConfig();

    // Check if project with same name already exists
    const existing = config.projects.find((p) => p.name === projectInput.name);
    if (existing) {
      throw new ConfigError(
        `Project with name "${projectInput.name}" already exists`
      );
    }

    // Create new project with generated ID and timestamps
    const now = new Date().toISOString();
    const project: ProjectConfig = {
      ...projectInput,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    config.projects.push(project);

    // Set as default if it's the first project
    if (config.projects.length === 1) {
      config.defaultProject = project.name;
    }

    await this.saveConfig(config);
    return project;
  }

  /**
   * Get a project by name
   */
  async getProject(name: string): Promise<ProjectConfig> {
    const config = await this.loadConfig();
    const project = config.projects.find((p) => p.name === name);

    if (!project) {
      throw new ConfigError(`Project "${name}" not found`);
    }

    return project;
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<ProjectConfig[]> {
    const config = await this.loadConfig();
    return config.projects;
  }

  /**
   * Update an existing project
   */
  async updateProject(
    name: string,
    updates: Partial<Omit<ProjectConfig, 'id' | 'name' | 'createdAt'>>
  ): Promise<ProjectConfig> {
    const config = await this.loadConfig();
    const projectIndex = config.projects.findIndex((p) => p.name === name);

    if (projectIndex === -1) {
      throw new ConfigError(`Project "${name}" not found`);
    }

    // Update project with new values and updated timestamp
    const updatedProject: ProjectConfig = {
      ...config.projects[projectIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    config.projects[projectIndex] = updatedProject;
    await this.saveConfig(config);

    return updatedProject;
  }

  /**
   * Delete a project by name
   */
  async deleteProject(name: string): Promise<void> {
    const config = await this.loadConfig();
    const projectIndex = config.projects.findIndex((p) => p.name === name);

    if (projectIndex === -1) {
      throw new ConfigError(`Project "${name}" not found`);
    }

    // Remove project from array
    config.projects.splice(projectIndex, 1);

    // Clear default project if it was the deleted one
    if (config.defaultProject === name) {
      delete config.defaultProject;
    }

    await this.saveConfig(config);
  }

  /**
   * Set the default project
   */
  async setDefaultProject(name: string): Promise<void> {
    const config = await this.loadConfig();

    // Verify project exists
    const project = config.projects.find((p) => p.name === name);
    if (!project) {
      throw new ConfigError(`Project "${name}" not found`);
    }

    config.defaultProject = name;
    await this.saveConfig(config);
  }

  /**
   * Get the default project
   */
  async getDefaultProject(): Promise<ProjectConfig> {
    const config = await this.loadConfig();

    if (!config.defaultProject) {
      throw new ConfigError(
        'No default project set. Use setDefaultProject() to set one.'
      );
    }

    return this.getProject(config.defaultProject);
  }
}