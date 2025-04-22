require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const emissionRoutes = require('./routes/emission.routes');
const challengeRoutes = require('./routes/challenge.routes');
const offsetRoutes = require('./routes/offset.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const { setupPassport } = require('./config/passport');
const { setupRedis, closeRedis } = require('./config/redis');
const { setupQueues, closeQueues } = require('./config/queues');
const logger = require('./utils/logger');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Initialize Passport
app.use(passport.initialize());
setupPassport();

// Setup Bull Board
const serverAdapter = new ExpressAdapter();
const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [],
  serverAdapter: serverAdapter,
});
serverAdapter.setBasePath('/admin/queues');
app.use('/admin/queues', serverAdapter.getRouter());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/emissions', emissionRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/offsets', offsetRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('Connected to MongoDB');
})
.catch((error) => {
  logger.error('MongoDB connection error:', error);
  process.exit(1);
});

// Setup Redis and queues
setupRedis()
  .then(() => setupQueues())
  .catch((error) => {
    logger.error('Redis/Queue setup error:', error);
    process.exit(1);
  });

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  
  // Close server
  server.close(async () => {
    logger.info('Server closed');
    
    try {
      // Close Redis connection
      await closeRedis();
      logger.info('Redis connection closed');
      
      // Close queues
      await closeQueues();
      logger.info('Queues closed');
      
      // Close MongoDB connection
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
      
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Promise Rejection:', error);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
}); 