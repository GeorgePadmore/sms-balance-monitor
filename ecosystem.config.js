module.exports = {
  apps: [{
    name: "sms-balance-monitor",
    script: "sms-balance-monitor.js",
    cwd: __dirname,
    exec_mode: "fork",  // Use fork mode, not cluster mode
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "200M",
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    log_file: "./logs/pm2-combined.log",
    time: true,
    env: {
      NODE_ENV: "production"
    },
    env_development: {
      NODE_ENV: "development"
    },
    // Restart policy
    min_uptime: "10s",
    max_restarts: 10,
    restart_delay: 4000,
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: false,
    listen_timeout: 10000
  }]
};
