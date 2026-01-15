/**
 * Base SMS Provider Class
 * 
 * This is an abstract base class that defines the interface for SMS providers.
 * All SMS provider implementations should extend this class and implement
 * the required methods.
 */
class BaseSMSProvider {
  constructor(config) {
    if (this.constructor === BaseSMSProvider) {
      throw new Error('BaseSMSProvider is abstract and cannot be instantiated directly');
    }
    this.config = config;
  }

  /**
   * Check SMS balance
   * @returns {Promise<number>} The current SMS balance
   * @throws {Error} If the balance check fails
   */
  async checkBalance() {
    throw new Error('checkBalance() must be implemented by the SMS provider');
  }

  /**
   * Send SMS message
   * @param {string|string[]} destinations - Phone number(s) to send SMS to
   * @param {string} message - The SMS message content
   * @param {string} [source] - Optional source identifier
   * @returns {Promise<Object>} The API response
   * @throws {Error} If sending SMS fails
   */
  async sendSMS(destinations, message, source = null) {
    throw new Error('sendSMS() must be implemented by the SMS provider');
  }

  /**
   * Validate provider configuration
   * @returns {boolean} True if configuration is valid
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    throw new Error('validateConfig() must be implemented by the SMS provider');
  }

  /**
   * Get provider name
   * @returns {string} The name of the SMS provider
   */
  getName() {
    return this.constructor.name;
  }
}

module.exports = BaseSMSProvider;
