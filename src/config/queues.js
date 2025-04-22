const Queue = require('bull');
const logger = require('../utils/logger');
const { getRedisClient } = require('./redis');

// Queue names
const QUEUE_NAMES = {
  EMAIL: 'email',
  PDF_GENERATION: 'pdf-generation',
  DATA_EXPORT: 'data-export',
  NOTIFICATION: 'notification',
  EMISSION_CALCULATION: 'emission-calculation'
};

// Queue configurations
const queueConfig = {
  redis: {
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
};

// Initialize queues
const queues = {};

const setupQueues = async () => {
  try {
    // Email queue
    queues.email = new Queue(QUEUE_NAMES.EMAIL, queueConfig);
    queues.email.process(async (job) => {
      logger.info(`Processing email job ${job.id}`);
      // Email processing logic will be implemented here
    });

    // PDF Generation queue
    queues.pdfGeneration = new Queue(QUEUE_NAMES.PDF_GENERATION, queueConfig);
    queues.pdfGeneration.process(async (job) => {
      logger.info(`Processing PDF generation job ${job.id}`);
      // PDF generation logic will be implemented here
    });

    // Data Export queue
    queues.dataExport = new Queue(QUEUE_NAMES.DATA_EXPORT, queueConfig);
    queues.dataExport.process(async (job) => {
      logger.info(`Processing data export job ${job.id}`);
      // Data export logic will be implemented here
    });

    // Notification queue
    queues.notification = new Queue(QUEUE_NAMES.NOTIFICATION, queueConfig);
    queues.notification.process(async (job) => {
      logger.info(`Processing notification job ${job.id}`);
      // Notification logic will be implemented here
    });

    // Emission Calculation queue
    queues.emissionCalculation = new Queue(QUEUE_NAMES.EMISSION_CALCULATION, queueConfig);
    queues.emissionCalculation.process(async (job) => {
      logger.info(`Processing emission calculation job ${job.id}`);
      // Emission calculation logic will be implemented here
    });

    // Add error handlers for all queues
    Object.values(queues).forEach(queue => {
      queue.on('error', (error) => {
        logger.error(`Queue error in ${queue.name}:`, error);
      });

      queue.on('failed', (job, error) => {
        logger.error(`Job ${job.id} in queue ${queue.name} failed:`, error);
      });

      queue.on('completed', (job) => {
        logger.info(`Job ${job.id} in queue ${queue.name} completed`);
      });

      queue.on('stalled', (job) => {
        logger.warn(`Job ${job.id} in queue ${queue.name} stalled`);
      });

      queue.on('waiting', (jobId) => {
        logger.info(`Job ${jobId} in queue ${queue.name} waiting`);
      });

      queue.on('active', (job) => {
        logger.info(`Job ${job.id} in queue ${queue.name} started processing`);
      });
    });

    logger.info('All queues initialized successfully');
    return queues;
  } catch (error) {
    logger.error('Queue setup error:', error);
    throw error;
  }
};

const getQueue = (queueName) => {
  if (!queues[queueName]) {
    throw new Error(`Queue ${queueName} not found`);
  }
  return queues[queueName];
};

const closeQueues = async () => {
  try {
    await Promise.all(
      Object.values(queues).map(async queue => {
        try {
          await queue.close();
          logger.info(`Queue ${queue.name} closed successfully`);
        } catch (error) {
          logger.error(`Error closing queue ${queue.name}:`, error);
          throw error;
        }
      })
    );
    logger.info('All queues closed successfully');
  } catch (error) {
    logger.error('Error closing queues:', error);
    throw error;
  }
};

module.exports = {
  QUEUE_NAMES,
  setupQueues,
  getQueue,
  closeQueues
}; 