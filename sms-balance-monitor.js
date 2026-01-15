const fs = require('fs');
const path = require('path');

// Import configuration
const config = require('./config');
const { validateConfig, SMS_PROVIDER, getProviderConfig, MONITOR_CONFIG, ALERT_CONFIG, FILE_PATHS } = config;

// Import provider registry
const providerRegistry = require('./providers/provider-registry');

// Initialize SMS provider through registry
let SMSProvider;
try {
  const providerConfig = getProviderConfig(SMS_PROVIDER);
  if (!providerConfig) {
    throw new Error(`No configuration found for provider '${SMS_PROVIDER}'. Available providers: ${providerRegistry.getAvailableProviders().join(', ')}`);
  }
  SMSProvider = providerRegistry.getProvider(SMS_PROVIDER, providerConfig);
} catch (error) {
  console.error(`Failed to initialize SMS provider: ${error.message}`);
  process.exit(1);
}

// Validate configuration
try {
  validateConfig();
} catch (error) {
  console.error(`Configuration error: ${error.message}`);
  process.exit(1);
}

// Extract configuration values
const {
  threshold: SMS_BAL_THRESHOLD,
  checkInterval: CHECK_INTERVAL,
  notificationCooldown: NOTIFICATION_COOLDOWN,
  maxConsecutiveNotifications: MAX_CONSECUTIVE_NOTIFICATIONS,
  balanceChangeThreshold: BALANCE_CHANGE_THRESHOLD
} = MONITOR_CONFIG;

const { recipients: ALERT_RECIPIENTS } = ALERT_CONFIG;
const { stateFile: STATE_FILE_PATH, logFile: LOG_FILE_PATH } = FILE_PATHS;

// Default state
const defaultState = {
  lastNotificationTime: null,
  consecutiveNotificationCount: 0,
  lastKnownBalance: null,
  lastCheckTime: null,
  totalChecks: 0,
  totalNotifications: 0
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Logs a message with timestamp to both console and log file
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  console.log(logMessage);
  
  // Append to log file (async, non-blocking)
  fs.appendFile(LOG_FILE_PATH, logMessage + '\n', (err) => {
    if (err) {
      console.error('Failed to write to log file:', err.message);
    }
  });
}

/**
 * Load state from file
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = fs.readFileSync(STATE_FILE_PATH, 'utf8');
      const state = JSON.parse(data);
      // Merge with default state to handle missing properties
      return { ...defaultState, ...state };
    }
  } catch (error) {
    log(`Error loading state file: ${error.message}`, 'ERROR');
  }
  return { ...defaultState };
}

/**
 * Save state to file
 */
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));
  } catch (error) {
    log(`Error saving state file: ${error.message}`, 'ERROR');
  }
}

// ============================================================================
// NOTIFICATION LOGIC
// ============================================================================

/**
 * Determine if notification should be sent based on rate limiting rules
 */
function shouldSendNotification(now, balance, state) {
  // Reset consecutive count if balance is above threshold
  if (balance > SMS_BAL_THRESHOLD) {
    if (state.consecutiveNotificationCount > 0) {
      log(`Balance recovered (${balance}). Resetting notification count.`, 'INFO');
      state.consecutiveNotificationCount = 0;
      state.lastKnownBalance = balance;
      saveState(state);
    }
    return false;
  }
  
  // Don't send if we've reached max consecutive notifications
  if (state.consecutiveNotificationCount >= MAX_CONSECUTIVE_NOTIFICATIONS) {
    return false;
  }
  
  // If this is the first alert for this low-balance period (no notifications sent yet), always send
  if (state.consecutiveNotificationCount === 0) {
    return true;
  }
  
  // Don't send if we've sent one recently (within cooldown period)
  if (state.lastNotificationTime && (now - state.lastNotificationTime) < NOTIFICATION_COOLDOWN) {
    return false;
  }
  
  // For subsequent alerts, only send if balance changed significantly
  if (state.lastKnownBalance !== null && 
      Math.abs(balance - state.lastKnownBalance) < BALANCE_CHANGE_THRESHOLD) {
    return false;
  }
  
  return true;
}

/**
 * Get reason why notification was skipped
 */
function getSkipReason(now, balance, state) {
  if (balance > SMS_BAL_THRESHOLD) {
    return 'Balance above threshold';
  }
  if (state.consecutiveNotificationCount >= MAX_CONSECUTIVE_NOTIFICATIONS) {
    return `Max consecutive notifications reached (${MAX_CONSECUTIVE_NOTIFICATIONS})`;
  }
  // First alert should always be sent
  if (state.consecutiveNotificationCount === 0) {
    return 'Unknown (should not happen)';
  }
  if (state.lastNotificationTime && (now - state.lastNotificationTime) < NOTIFICATION_COOLDOWN) {
    const minutesRemaining = Math.ceil((NOTIFICATION_COOLDOWN - (now - state.lastNotificationTime)) / 60000);
    return `Within cooldown period (${minutesRemaining} minutes remaining)`;
  }
  // For subsequent alerts, check balance change
  if (state.lastKnownBalance !== null && 
      Math.abs(balance - state.lastKnownBalance) < BALANCE_CHANGE_THRESHOLD) {
    return `Balance change too small (< ${BALANCE_CHANGE_THRESHOLD} units)`;
  }
  return 'Unknown';
}

/**
 * Send low SMS balance alert
 */
async function alertLowSMSBalance(balance) {
  const now = Date.now();
  const state = loadState();
  
  // Check if we should send notification based on rate limiting
  if (shouldSendNotification(now, balance, state)) {
    try {
      const notificationNumber = state.consecutiveNotificationCount + 1;
      const message = `Hello Admin, SMS balance is low. Please recharge immediately!\nCurrent Balance: ${balance}\nNotification #${notificationNumber}`;
      
      // Use SMS provider to send alert
      await SMSProvider.sendSMS(ALERT_RECIPIENTS, message);
      
      // Update tracking state
      state.lastNotificationTime = now;
      state.consecutiveNotificationCount++;
      state.lastKnownBalance = balance;
      state.totalNotifications++;
      
      // Save updated state
      saveState(state);
      
      log(`SMS notification sent via ${SMSProvider.getName()}. Count: ${notificationNumber}/${MAX_CONSECUTIVE_NOTIFICATIONS}, Balance: ${balance}`, 'WARN');
    } catch (error) {
      log(`Failed to send SMS notification: ${error.message}`, 'ERROR');
    }
  } else {
    const reason = getSkipReason(now, balance, state);
    log(`SMS notification skipped. Balance: ${balance}, Reason: ${reason}`, 'INFO');
  }
}

// ============================================================================
// MAIN MONITORING LOGIC
// ============================================================================

/**
 * Check SMS balance and handle alerts
 */
async function checkSMSBalance() {
  const state = loadState();
  state.totalChecks++;
  state.lastCheckTime = Date.now();
  saveState(state);
  
  try {
    // Use SMS provider to check balance
    const balance = await SMSProvider.checkBalance();
    log(`Balance check: ${balance} (Threshold: ${SMS_BAL_THRESHOLD})`, 'INFO');
    
    if (balance !== null && balance !== undefined) {
      if (balance <= SMS_BAL_THRESHOLD) {
        await alertLowSMSBalance(balance);
      } else {
        // Reset consecutive count when balance is above threshold
        if (state.consecutiveNotificationCount > 0) {
          log(`Balance recovered (${balance}). Resetting notification count.`, 'INFO');
          state.consecutiveNotificationCount = 0;
          state.lastKnownBalance = balance;
          saveState(state);
        } else {
          // Update last known balance even when above threshold
          state.lastKnownBalance = balance;
          saveState(state);
        }
      }
    } else {
      log('Warning: Received null or undefined balance', 'WARN');
    }
  } catch (error) {
    log(`SMS Balance check failed: ${error.message}`, 'ERROR');
    // Don't exit on error, continue monitoring
  }
}

/**
 * Main monitoring loop
 */
async function startMonitoring() {
  log('========================================', 'INFO');
  log('SMS Balance Monitor Started', 'INFO');
  log(`SMS Provider: ${SMSProvider.getName()}`, 'INFO');
  log(`Check Interval: ${CHECK_INTERVAL / 1000 / 60} minutes`, 'INFO');
  log(`Threshold: ${SMS_BAL_THRESHOLD}`, 'INFO');
  log(`Notification Cooldown: ${NOTIFICATION_COOLDOWN / 1000 / 60} minutes`, 'INFO');
  log(`Max Consecutive Notifications: ${MAX_CONSECUTIVE_NOTIFICATIONS}`, 'INFO');
  log(`Balance Change Threshold: ${BALANCE_CHANGE_THRESHOLD}`, 'INFO');
  log('========================================', 'INFO');
  
  // Perform initial check immediately
  await checkSMSBalance();
  
  // Set up interval for subsequent checks
  const intervalId = setInterval(async () => {
    await checkSMSBalance();
  }, CHECK_INTERVAL);
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down gracefully...', 'INFO');
    clearInterval(intervalId);
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    log('Received SIGINT, shutting down gracefully...', 'INFO');
    clearInterval(intervalId);
    process.exit(0);
  });
  
  // Handle uncaught errors
  process.on('unhandledRejection', (error) => {
    log(`Unhandled promise rejection: ${error.message}`, 'ERROR');
    // Don't exit, continue monitoring
  });
  
  process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error.message}`, 'ERROR');
    // Exit on uncaught exception as it may indicate a serious problem
    clearInterval(intervalId);
    process.exit(1);
  });
}

// ============================================================================
// START APPLICATION
// ============================================================================

// Start monitoring
startMonitoring().catch((error) => {
  log(`Fatal error starting monitor: ${error.message}`, 'ERROR');
  process.exit(1);
});
