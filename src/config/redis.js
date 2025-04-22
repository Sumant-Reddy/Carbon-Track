const Redis = require('redis');
const logger = require('../utils/logger');

let redisClient;

const setupRedis = async () => {
  try {
    redisClient = Redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis Client Reconnecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Redis Setup Error:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

const closeRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
      throw error;
    }
  }
};

module.exports = {
  setupRedis,
  getRedisClient,
  closeRedis
}; 