# SMS Balance Monitor

## Overview

A robust, production-ready, and **highly modular** system that continuously monitors SMS balance and sends intelligent notifications when the balance falls below a specified threshold. The system features a **provider-based architecture** that makes it easy to support multiple SMS providers and reuse across different projects.

## Features

- **Modular Architecture**: Provider-based design allows easy integration of multiple SMS providers
- **Continuous Monitoring**: Runs as a persistent service, checking balance at configurable intervals (default: 5 minutes)
- **Smart Rate Limiting**: Multiple layers of protection against notification spam:
  - **Cooldown Period**: 30 minutes between notifications
  - **Consecutive Limit**: Maximum 4 consecutive notifications before stopping
  - **Balance Change Detection**: Only notifies when balance changes by at least 10 units
- **Balance Recovery Detection**: Automatically resets notification counter when balance recovers above threshold
- **Persistent State Tracking**: Maintains notification state between restarts
- **Comprehensive Logging**: Detailed logs with timestamps for monitoring and debugging
- **Error Handling**: Robust error handling with graceful degradation
- **PM2 Integration**: Ready-to-use PM2 ecosystem configuration for process management
- **Easy Configuration**: Centralized config file for all settings
- **Reusable**: Designed to be easily adapted for other projects

## Architecture

The system uses a **provider-based architecture with a registry pattern** that separates concerns:

1. **SMS Providers** (`providers/`): Handle all SMS provider-specific logic (API calls, authentication, etc.)
2. **Provider Registry** (`providers/provider-registry.js`): Factory/registry that manages provider selection and initialization
3. **Monitor Script** (`sms-balance-monitor.js`): Contains pure business logic (threshold checking, rate limiting, state management) - **completely agnostic of which provider is used**
4. **Configuration** (`config.js`): Centralized configuration for easy customization

This design allows you to:
- Easily add new SMS providers by creating a new provider class and registering it
- Reuse the monitor script across different projects by just changing config
- Keep business logic completely separate from provider-specific implementation details
- The monitor script never needs to know which provider is being used - it just calls `SMSProvider.checkBalance()` and `SMSProvider.sendSMS()`

The system runs as a continuous process (not a cron job) with internal intervals. This approach provides:
- Better error recovery
- Persistent state management
- More reliable monitoring
- Easier process management via PM2

## Directory Structure

```
sms-balance-monitor/
├── sms-balance-monitor.js    # Main monitoring script (business logic only, provider-agnostic)
├── config.js                 # Centralized configuration
├── ecosystem.config.js       # PM2 configuration
├── providers/                # SMS provider implementations
│   ├── base-sms-provider.js  # Abstract base class for providers
│   ├── provider-registry.js  # Provider factory/registry (handles provider selection)
│   ├── deywuro.js            # Deywuro SMS provider implementation
│   └── index.js              # Provider exports
├── sms_notification_state.json # Persistent state (auto-generated)
├── sms-balance-monitor.log   # Application logs (auto-generated)
├── logs/                     # PM2 logs directory
│   ├── pm2-error.log
│   ├── pm2-out.log
│   └── pm2-combined.log
└── README.md                 # This file
```

## Configuration

All configuration is centralized in `config.js` and can be customized via environment variables or by editing the config file directly.

### Environment Variables

Create a `.env` file in the `sms-balance-monitor` directory (or use the parent `.env` file):

#### SMS Provider Configuration (Deywuro)

```env
# SMS Provider (currently supports: deywuro)
SMS_PROVIDER=deywuro

# Deywuro Provider Settings
SMS_URL="https://api.deywuro.com/bulksms/credit_bal.php"  # Balance check URL
SMS_SEND_URL="https://deywuro.com/api/sms"                 # SMS sending URL (optional, has default)
SMS_USERNAME="your_username"
SMS_PASSWORD="your_password"
SMS_SOURCE="SENDERID"                                         # Optional, defaults to "SENDERID"
```

#### Monitoring Configuration

```env
# Balance threshold - alerts sent when balance falls below this
SMS_BAL_THRESHOLD=700

# Check interval in milliseconds (default: 300000 = 5 minutes)
SMS_CHECK_INTERVAL=300000

# Cooldown between notifications in milliseconds (default: 1800000 = 30 minutes)
SMS_NOTIFICATION_COOLDOWN=1800000

# Maximum consecutive notifications (default: 4)
SMS_MAX_CONSECUTIVE_NOTIFICATIONS=4

# Minimum balance change to trigger subsequent notifications (default: 10)
SMS_BALANCE_CHANGE_THRESHOLD=10
```

#### Alert Configuration

```env
# Comma-separated list of phone numbers to receive alerts
SMS_ALERT_RECIPIENTS="0541840988,0501302075"
```

### Configuration File

Alternatively, you can edit `config.js` directly to set default values:

```javascript
const MONITOR_CONFIG = {
  threshold: 700,                    // Balance threshold
  checkInterval: 5 * 60 * 1000,     // 5 minutes
  notificationCooldown: 30 * 60 * 1000, // 30 minutes
  maxConsecutiveNotifications: 4,
  balanceChangeThreshold: 10
};
```

### Quick Configuration Guide

**For a new project:**
1. Copy the `sms-balance-monitor` directory
2. Update `.env` file with your SMS provider credentials
3. Adjust threshold and monitoring settings in `config.js` or via environment variables
4. Update alert recipients in `config.js` or `SMS_ALERT_RECIPIENTS` env var
5. Done! The monitor is ready to use.

## Rate Limiting Details

### Current Cooldown/Interval Configuration

1. **Check Interval**: **5 minutes**
   - The script checks SMS balance every 5 minutes
   - This is configurable via `CHECK_INTERVAL` constant

2. **Notification Cooldown**: **30 minutes**
   - After sending a notification, the system waits 30 minutes before sending another
   - This prevents spam even if balance remains low
   - Configurable via `NOTIFICATION_COOLDOWN` constant

3. **Maximum Consecutive Notifications**: **4**
   - After 4 consecutive notifications, the system stops sending alerts
   - Counter resets when balance recovers above threshold
   - Configurable via `MAX_CONSECUTIVE_NOTIFICATIONS` constant

4. **Balance Change Threshold**: **10 units**
   - Only sends notification if balance changes by at least 10 units
   - Prevents notifications for minor fluctuations
   - Configurable via `BALANCE_CHANGE_THRESHOLD` constant

### Rate Limiting Logic Flow

```
1. Check balance every 5 minutes
2. If balance <= threshold:
   a. Check if 30 minutes have passed since last notification → If not, skip
   b. Check if already sent 4 consecutive notifications → If yes, skip
   c. Check if balance changed by at least 10 units → If not, skip
   d. If all checks pass → Send notification
3. If balance > threshold:
   a. Reset consecutive notification counter
   b. Update last known balance
```

## Installation and Setup

### 1. Prerequisites

- Node.js (v14 or higher)
- PM2 (for process management)
- SMS API credentials

### 2. Install Dependencies

Dependencies should already be installed in the parent `scripts` directory. If not:

```bash
cd /opt/apps/apis/zippy-api/scripts
npm install axios dotenv
```

### 3. Install PM2 (if not already installed)

```bash
npm install -g pm2
```

### 4. Configure Environment Variables

Ensure the `.env` file exists in `/opt/apps/apis/zippy-api/scripts/.env` with required variables.

### 5. Start the Monitor with PM2

```bash
cd /opt/apps/apis/zippy-api/scripts/sms-balance-monitor
pm2 start ecosystem.config.js
```

### 6. Save PM2 Configuration

To ensure the process restarts on system reboot:

```bash
pm2 save
pm2 startup
```

## Usage

### Starting the Monitor

```bash
cd /opt/apps/apis/zippy-api/scripts/sms-balance-monitor
pm2 start ecosystem.config.js
```

### Stopping the Monitor

```bash
pm2 stop sms-balance-monitor
```

### Restarting the Monitor

```bash
pm2 restart sms-balance-monitor
```

### Viewing Logs

```bash
# Real-time logs
pm2 logs sms-balance-monitor

# Application logs
tail -f sms-balance-monitor.log

# PM2 logs
tail -f logs/pm2-combined.log
```

### Checking Status

```bash
pm2 status
pm2 info sms-balance-monitor
```

### Manual Testing

```bash
cd /opt/apps/apis/zippy-api/scripts/sms-balance-monitor
node sms-balance-monitor.js
```

Press `Ctrl+C` to stop.

## Monitoring and Logs

### Log Files

1. **Application Log**: `sms-balance-monitor.log`
   - Contains all application logs with timestamps
   - Includes balance checks, notifications, and errors

2. **PM2 Logs**: `logs/pm2-*.log`
   - PM2 process logs
   - Error and output streams

### Log Output Examples

**Startup:**
```
[2025-01-15T10:00:00.000Z] [INFO] ========================================
[2025-01-15T10:00:00.000Z] [INFO] SMS Balance Monitor Started
[2025-01-15T10:00:00.000Z] [INFO] Check Interval: 5 minutes
[2025-01-15T10:00:00.000Z] [INFO] Threshold: 100
[2025-01-15T10:00:00.000Z] [INFO] Notification Cooldown: 30 minutes
[2025-01-15T10:00:00.000Z] [INFO] Max Consecutive Notifications: 4
[2025-01-15T10:00:00.000Z] [INFO] ========================================
```

**Balance Check:**
```
[2025-01-15T10:05:00.000Z] [INFO] Balance check: 459.79 (Threshold: 100)
```

**Notification Sent:**
```
[2025-01-15T10:10:00.000Z] [WARN] SMS notification sent. Count: 1/4, Balance: 95.5
```

**Notification Skipped:**
```
[2025-01-15T10:15:00.000Z] [INFO] SMS notification skipped. Balance: 95.2, Reason: Within cooldown period (25 minutes remaining)
```

**Balance Recovery:**
```
[2025-01-15T10:20:00.000Z] [INFO] Balance recovered (150). Resetting notification count.
```

### State File

The state file (`sms_notification_state.json`) tracks:

```json
{
  "lastNotificationTime": 1765810635926,
  "consecutiveNotificationCount": 0,
  "lastKnownBalance": 459.79500000011075,
  "lastCheckTime": 1765810635926,
  "totalChecks": 42,
  "totalNotifications": 2
}
```

## Customization

### Adjust Monitoring Settings

Edit `config.js` or set environment variables:

```javascript
// In config.js
const MONITOR_CONFIG = {
  threshold: 50,                      // Lower threshold
  checkInterval: 10 * 60 * 1000,     // Check every 10 minutes
  notificationCooldown: 60 * 60 * 1000, // 1 hour cooldown
  maxConsecutiveNotifications: 6,    // More notifications
  balanceChangeThreshold: 5          // More sensitive
};
```

### Add More Recipients

**Via environment variable:**
```env
SMS_ALERT_RECIPIENTS="0541840988,0501302075,0241234567"
```

**Or edit `config.js`:**
```javascript
const ALERT_CONFIG = {
  recipients: ['0541840988', '0501302075', '0241234567']
};
```

## Adding a New SMS Provider

The modular architecture with provider registry makes it easy to add support for new SMS providers. **The monitor script doesn't need any changes!**

### Step 1: Create Provider Class

Create a new file in `providers/` directory, e.g., `providers/twilio.js`:

```javascript
const BaseSMSProvider = require('./base-sms-provider');
const axios = require('axios');

class TwilioProvider extends BaseSMSProvider {
  constructor(config) {
    super(config);
    this.validateConfig();
  }

  validateConfig() {
    const required = ['accountSid', 'authToken', 'phoneNumber'];
    const missing = required.filter(key => !this.config[key]);
    if (missing.length > 0) {
      throw new Error(`Twilio provider missing required config: ${missing.join(', ')}`);
    }
  }

  async checkBalance() {
    // Implement balance check logic for Twilio
    // Return the balance as a number
    const response = await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Balance.json`, {
      auth: {
        username: this.config.accountSid,
        password: this.config.authToken
      }
    });
    return parseFloat(response.data.balance);
  }

  async sendSMS(destinations, message, source = null) {
    // Implement SMS sending logic for Twilio
    // Return the API response
    const from = source || this.config.phoneNumber;
    const to = Array.isArray(destinations) ? destinations[0] : destinations;
    
    return axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`,
      new URLSearchParams({ From: from, To: to, Body: message }),
      {
        auth: { username: this.config.accountSid, password: this.config.authToken }
      }
    );
  }
}

module.exports = TwilioProvider;
```

### Step 2: Register Provider

Add the provider to `providers/provider-registry.js`:

```javascript
const DeywuroProvider = require('./deywuro');
const TwilioProvider = require('./twilio');  // Add this

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.registeredProviders = {
      deywuro: DeywuroProvider,
      twilio: TwilioProvider  // Add this
    };
  }
  // ... rest of the class
}
```

### Step 3: Add Configuration

Add provider configuration to `config.js`:

```javascript
// Add Twilio config
const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER
};

// Update getProviderConfig function
function getProviderConfig(providerName) {
  const configMap = {
    deywuro: DEYWURO_CONFIG,
    twilio: TWILIO_CONFIG  // Add this
  };
  return configMap[providerName];
}

// Update validateConfig to validate Twilio
function validateConfig() {
  // ... existing validation
  if (SMS_PROVIDER === 'twilio') {
    if (!TWILIO_CONFIG.accountSid) errors.push('TWILIO_ACCOUNT_SID required');
    if (!TWILIO_CONFIG.authToken) errors.push('TWILIO_AUTH_TOKEN required');
    if (!TWILIO_CONFIG.phoneNumber) errors.push('TWILIO_PHONE_NUMBER required');
  }
}
```

### Step 4: Use the New Provider

Set the environment variable:
```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_phone_number
```

**That's it!** The monitor script automatically uses the new provider through the registry. No changes needed to `sms-balance-monitor.js`!

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   - Ensure `.env` file exists in `/opt/apps/apis/zippy-api/scripts/.env`
   - Check file permissions
   - Verify variable names match exactly

2. **PM2 Process Not Starting**
   - Check PM2 installation: `pm2 --version`
   - Verify ecosystem.config.js syntax
   - Check PM2 logs: `pm2 logs sms-balance-monitor`

3. **API Connection Errors**
   - Check internet connectivity
   - Verify API credentials
   - Check API endpoint URL
   - Review application logs for detailed error messages

4. **Notifications Not Sending**
   - Check state file for rate limiting status
   - Verify recipient phone numbers
   - Check application logs for skip reasons
   - Ensure balance is actually below threshold

5. **State File Issues**
   - Ensure directory is writable
   - Check file permissions
   - Delete state file to reset (will recreate automatically)

### Debug Commands

```bash
# Check PM2 status
pm2 status
pm2 info sms-balance-monitor

# View real-time logs
pm2 logs sms-balance-monitor --lines 100

# Check environment variables
cd /opt/apps/apis/zippy-api/scripts && node -e "require('dotenv').config(); console.log(process.env.SMS_URL);"

# View state file
cat sms_notification_state.json

# Test script manually
cd /opt/apps/apis/zippy-api/scripts/sms-balance-monitor
node sms-balance-monitor.js

# Check PM2 logs
tail -f logs/pm2-combined.log
```

## Security Considerations

- Keep `.env` file secure and never commit to version control
- Use strong passwords for SMS API credentials
- Regularly rotate API credentials
- Monitor logs for suspicious activity
- Ensure proper file permissions on sensitive files
- Review and limit notification recipients

## Maintenance

### Regular Tasks

1. **Monitor Logs**: Check for errors or unusual patterns weekly
2. **Update Credentials**: Rotate SMS API credentials periodically
3. **Clean Logs**: Archive old log files to prevent disk space issues
4. **Test System**: Periodically test the notification system
5. **Review Thresholds**: Adjust thresholds based on usage patterns
6. **Check State File**: Review state file for any anomalies

### Backup

Important files to backup:
- `.env` (contains sensitive credentials)
- `sms_notification_state.json` (current state)
- `sms-balance-monitor.js` (main script)
- `ecosystem.config.js` (PM2 configuration)

### Log Rotation

Consider setting up log rotation for PM2:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Reusing in Other Projects

The modular design makes it easy to reuse this monitor in other projects:

1. **Copy the directory**: Copy the entire `sms-balance-monitor` directory to your new project
2. **Configure SMS Provider**: Update `.env` with your SMS provider credentials
3. **Adjust Settings**: Modify `config.js` or set environment variables for your needs:
   - Update threshold
   - Adjust check intervals
   - Set alert recipients
   - Configure rate limiting
4. **Install Dependencies**: Run `npm install` in the scripts directory (if not already done)
5. **Start Monitor**: Use PM2 to start the monitor

The monitor script contains **zero hardcoded business logic** - everything is configurable!

## Migration from Old Script

If migrating from the old `sms.js` script:

1. The state file has been automatically moved to the new directory
2. Stop any cron jobs running the old script
3. Start the new monitor with PM2
4. Verify it's working correctly
5. Remove or archive the old `sms.js` file

## Performance

- **Memory Usage**: Typically < 50MB
- **CPU Usage**: Minimal (mostly idle between checks)
- **Network**: One API call every 5 minutes (configurable)
- **Disk**: Log files grow slowly, consider log rotation

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review application and PM2 logs
3. Test components individually
4. Contact system administrator

---

**Last Updated**: January 2025  
**Version**: 2.0  
**Maintainer**: System Administrator
