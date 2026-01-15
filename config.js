const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

/**
 * SMS Balance Monitor Configuration
 * 
 * This file contains all configuration for the SMS balance monitor.
 * Modify these values to customize the monitor for your needs.
 */

// ============================================================================
// SMS PROVIDER CONFIGURATION
// ============================================================================

// Available providers: 'deywuro'
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'deywuro';

// Deywuro Provider Configuration
const DEYWURO_CONFIG = {
  balanceUrl: process.env.SMS_URL || process.env.SMS_BALANCE_URL,
  sendUrl: process.env.SMS_SEND_URL || 'https://deywuro.com/api/sms',
  username: process.env.SMS_USERNAME,
  password: process.env.SMS_PASSWORD,
  source: process.env.SMS_SOURCE || 'ZIPPY'
};

// ============================================================================
// MONITORING CONFIGURATION
// ============================================================================

const MONITOR_CONFIG = {
  // Balance threshold - alerts will be sent when balance falls below this
  threshold: parseInt(process.env.SMS_BAL_THRESHOLD) || 700,
  
  // How often to check the balance (in milliseconds)
  checkInterval: parseInt(process.env.SMS_CHECK_INTERVAL) || (5 * 60 * 1000), // 5 minutes
  
  // Cooldown period between notifications (in milliseconds)
  notificationCooldown: parseInt(process.env.SMS_NOTIFICATION_COOLDOWN) || (30 * 60 * 1000), // 30 minutes
  
  // Maximum consecutive notifications before stopping
  maxConsecutiveNotifications: parseInt(process.env.SMS_MAX_CONSECUTIVE_NOTIFICATIONS) || 4,
  
  // Minimum balance change required to send subsequent notifications (in units)
  balanceChangeThreshold: parseInt(process.env.SMS_BALANCE_CHANGE_THRESHOLD) || 10
};

// ============================================================================
// ALERT CONFIGURATION
// ============================================================================

const ALERT_CONFIG = {
  // Phone numbers to send alerts to
  recipients: process.env.SMS_ALERT_RECIPIENTS 
    ? process.env.SMS_ALERT_RECIPIENTS.split(',').map(r => r.trim())
    : ['']
};

// ============================================================================
// FILE PATHS
// ============================================================================

const FILE_PATHS = {
  stateFile: path.join(__dirname, 'sms_notification_state.json'),
  logFile: path.join(__dirname, 'sms-balance-monitor.log')
};

// ============================================================================
// VALIDATION
// ============================================================================

function validateConfig() {
  const errors = [];
  
  // Validate SMS provider config based on selected provider
  if (SMS_PROVIDER === 'deywuro') {
    if (!DEYWURO_CONFIG.balanceUrl) {
      errors.push('SMS_URL or SMS_BALANCE_URL is required for Deywuro provider');
    }
    if (!DEYWURO_CONFIG.username) {
      errors.push('SMS_USERNAME is required for Deywuro provider');
    }
    if (!DEYWURO_CONFIG.password) {
      errors.push('SMS_PASSWORD is required for Deywuro provider');
    }
  } else {
    errors.push(`Unknown SMS provider: ${SMS_PROVIDER}. Available providers: deywuro`);
  }
  
  // Validate alert recipients
  if (!ALERT_CONFIG.recipients || ALERT_CONFIG.recipients.length === 0) {
    errors.push('At least one SMS_ALERT_RECIPIENTS is required');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }
}

// ============================================================================
// PROVIDER CONFIGURATION MAPPING
// ============================================================================

/**
 * Get provider configuration based on provider name
 * This allows easy addition of new providers
 */
function getProviderConfig(providerName) {
  const configMap = {
    deywuro: DEYWURO_CONFIG
    // Add more providers here as needed
    // twilio: TWILIO_CONFIG,
    // nexmo: NEXMO_CONFIG,
  };

  return configMap[providerName];
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  SMS_PROVIDER,
  getProviderConfig,
  MONITOR_CONFIG,
  ALERT_CONFIG,
  FILE_PATHS,
  validateConfig
};
