const axios = require('axios');
const BaseSMSProvider = require('./base-sms-provider');

/**
 * Deywuro SMS Provider
 * 
 * Implementation of SMS provider for Deywuro SMS service.
 * 
 * Configuration:
 * {
 *   balanceUrl: "https://api.deywuro.com/bulksms/credit_bal.php",
 *   sendUrl: "https://deywuro.com/api/sms",
 *   username: "your_username",
 *   password: "your_password",
 *   source: "ZIPPY" // Optional, defaults to "ZIPPY"
 * }
 */
class DeywuroProvider extends BaseSMSProvider {
  constructor(config) {
    super(config);
    this.validateConfig();
  }

  /**
   * Validate provider configuration
   */
  validateConfig() {
    const required = ['balanceUrl', 'sendUrl', 'username', 'password'];
    const missing = required.filter(key => !this.config[key]);
    
    if (missing.length > 0) {
      throw new Error(`Deywuro provider missing required config: ${missing.join(', ')}`);
    }
  }

  /**
   * Make HTTP API request with error handling
   * @private
   */
  async makeApiRequest(url, method = 'get', data = null) {
    try {
      const config = { 
        method, 
        url, 
        timeout: 30000 // 30 second timeout
      };
      
      if (data) {
        if (method.toLowerCase() === 'get') {
          config.params = data;
        } else {
          config.data = data;
        }
      }
      
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`API request failed: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('API request failed: No response received');
      } else {
        throw new Error(`API request failed: ${error.message}`);
      }
    }
  }

  /**
   * Check SMS balance from Deywuro API
   * @returns {Promise<number>} The current SMS balance
   */
  async checkBalance() {
    const payload = `${this.config.balanceUrl}?username=${this.config.username}&password=${this.config.password}`;
    
    try {
      const requestConfig = {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      };

      const response = await axios.get(payload, requestConfig);
      
      if (response.data && typeof response.data.balance !== 'undefined') {
        return Number(response.data.balance);
      }
      
      throw new Error('Invalid response format: balance not found');
    } catch (error) {
      if (error.response) {
        throw new Error(`Balance check failed: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Balance check failed: No response received');
      } else {
        throw new Error(`Balance check failed: ${error.message}`);
      }
    }
  }

  /**
   * Send SMS via Deywuro API
   * @param {string|string[]} destinations - Phone number(s) to send SMS to
   * @param {string} message - The SMS message content
   * @param {string} [source] - Optional source identifier (defaults to config.source or "ZIPPY")
   * @returns {Promise<Object>} The API response
   */
  async sendSMS(destinations, message, source = null) {
    const url = this.config.sendUrl;
    const smsSource = source || this.config.source || 'ZIPPY';
    
    const data = {
      username: this.config.username,
      password: this.config.password,
      destination: Array.isArray(destinations) ? destinations.join(',') : destinations,
      message,
      source: smsSource
    };
    
    return this.makeApiRequest(url, 'post', data);
  }
}

module.exports = DeywuroProvider;
