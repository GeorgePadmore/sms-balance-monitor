/**
 * SMS Provider Index
 * 
 * This file exports all available SMS providers and the provider registry.
 * To add a new provider:
 * 1. Create a new provider class in this directory extending BaseSMSProvider
 * 2. Import and register it in provider-registry.js
 * 3. Add its configuration to config.js getProviderConfig() function
 */

const DeywuroProvider = require('./deywuro');
const BaseSMSProvider = require('./base-sms-provider');
const providerRegistry = require('./provider-registry');

module.exports = {
  BaseSMSProvider,
  DeywuroProvider,
  providerRegistry
};
