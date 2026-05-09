import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  node_env: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/home_automation',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expires_in: process.env.JWT_EXPIRES_IN || '7d',
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  app: {
    name: process.env.APP_NAME || 'Home Automation',
    version: process.env.APP_VERSION || '1.0.0',
    url: process.env.APP_URL || 'http://localhost:3000',
  },

  mqtt: {
    broker_url: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || 'home_automation',
    password: process.env.MQTT_PASSWORD || 'your-mqtt-password',
    topic_prefix: process.env.MQTT_TOPIC_PREFIX || 'home',
  },

  rate_limit: {
    window_ms: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max_requests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  },
};
