/**
 * SMS Provider Registry
 * 
 * This class handles provider selection, initialization, and management.
 * It acts as a factory and registry for SMS providers, allowing the monitor
 * to use providers without knowing their specific implementation.
 */

const DeywuroProvider = require('./deywuro');

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.registeredProviders = {
      deywuro: DeywuroProvider
    };
  }

  /**
   * Register a new SMS provider
   * @param {string} name - Provider name/identifier
   * @param {class} ProviderClass - Provider class that extends BaseSMSProvider
   */
  register(name, ProviderClass) {
    this.registeredProviders[name] = ProviderClass;
  }

  /**
   * Get or create a provider instance
   * @param {string} providerName - Name of the provider to use
   * @param {Object} config - Provider configuration
   * @returns {BaseSMSProvider} Provider instance
   */
  getProvider(providerName, config) {
    // Check if we already have an instance for this provider
    const cacheKey = `${providerName}_${JSON.stringify(config)}`;
    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey);
    }

    // Check if provider is registered
    if (!this.registeredProviders[providerName]) {
      throw new Error(`SMS provider '${providerName}' is not registered. Available providers: ${Object.keys(this.registeredProviders).join(', ')}`);
    }

    // Create new provider instance
    const ProviderClass = this.registeredProviders[providerName];
    let providerInstance;

    try {
      providerInstance = new ProviderClass(config);
    } catch (error) {
      throw new Error(`Failed to initialize SMS provider '${providerName}': ${error.message}`);
    }

    // Cache the instance
    this.providers.set(cacheKey, providerInstance);
    return providerInstance;
  }

  /**
   * Get list of available provider names
   * @returns {string[]} Array of provider names
   */
  getAvailableProviders() {
    return Object.keys(this.registeredProviders);
  }

  /**
   * Clear cached provider instances
   */
  clearCache() {
    this.providers.clear();
  }
}

// Export singleton instance
module.exports = new ProviderRegistry();
