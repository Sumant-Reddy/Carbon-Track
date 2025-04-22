const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const Emission = require('../models/emission.model');
const User = require('../models/user.model');
const Challenge = require('../models/challenge.model');
const { getRedisClient } = require('../config/redis');
const { getQueue } = require('../config/queues');
const logger = require('../utils/logger');

const router = express.Router();

// Get user's emissions overview
router.get('/overview', authenticate, async (req, res, next) => {
  try {
    const redis = getRedisClient();
    const cacheKey = `emissions:overview:${req.user.id}`;
    
    // Try to get from cache
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const now = new Date();
    const lastMonth = new Date(now.setMonth(now.getMonth() - 1));

    // Get emissions data
    const [monthlyEmissions, categoryBreakdown, trends] = await Promise.all([
      Emission.getTotalEmissions(req.user.id, lastMonth, now),
      Emission.aggregate([
        { $match: { user: req.user._id } },
        { $group: { 
          _id: '$category',
          total: { $sum: '$co2e' },
          count: { $sum: 1 }
        }}
      ]),
      Emission.aggregate([
        { $match: { user: req.user._id } },
        { $group: {
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          total: { $sum: '$co2e' }
        }},
        { $sort: { '_id': -1 } },
        { $limit: 30 }
      ])
    ]);

    const data = {
      monthlyEmissions,
      categoryBreakdown,
      trends,
      lastUpdated: new Date()
    };

    // Cache for 15 minutes
    await redis.setex(cacheKey, 900, JSON.stringify(data));

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Get global leaderboard
router.get('/leaderboard', authenticate, async (req, res, next) => {
  try {
    const redis = getRedisClient();
    const cacheKey = 'global:leaderboard';
    
    // Try to get from cache
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const now = new Date();
    const lastMonth = new Date(now.setMonth(now.getMonth() - 1));

    const leaderboard = await User.aggregate([
      {
        $lookup: {
          from: 'emissions',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user', '$$userId'] },
                    { $gte: ['$date', lastMonth] },
                    { $lte: ['$date', now] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                totalEmissions: { $sum: '$co2e' },
                improvementRate: {
                  $avg: {
                    $subtract: [
                      { $arrayElemAt: ['$co2e', 0] },
                      { $arrayElemAt: ['$co2e', -1] }
                    ]
                  }
                }
              }
            }
          ],
          as: 'emissionStats'
        }
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          profilePicture: 1,
          stats: { $arrayElemAt: ['$emissionStats', 0] },
          rank: 1
        }
      },
      { $sort: { 'stats.totalEmissions': 1 } },
      { $limit: 100 }
    ]);

    // Add ranks
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      ...user,
      rank: index + 1
    }));

    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(rankedLeaderboard));

    res.json(rankedLeaderboard);
  } catch (error) {
    next(error);
  }
});

// Get user's challenge progress
router.get('/challenges', authenticate, async (req, res, next) => {
  try {
    const challenges = await Challenge.find({
      'participants.user': req.user._id,
      status: 'active'
    })
    .select('title description goal participants.progress participants.status')
    .sort({ 'duration.endDate': 1 });

    res.json(challenges);
  } catch (error) {
    next(error);
  }
});

// Export user data (GDPR compliance)
router.post('/export', authenticate, async (req, res, next) => {
  try {
    const exportQueue = getQueue('data-export');
    const job = await exportQueue.add('user-data-export', {
      userId: req.user.id,
      email: req.user.email,
      format: req.body.format || 'pdf'
    });

    res.json({
      status: 'success',
      message: 'Export job queued',
      jobId: job.id
    });
  } catch (error) {
    next(error);
  }
});

// Delete user data (GDPR compliance)
router.delete('/data', authenticate, async (req, res, next) => {
  try {
    // Delete user's emissions
    await Emission.deleteMany({ user: req.user._id });

    // Remove user from challenges
    await Challenge.updateMany(
      { 'participants.user': req.user._id },
      { $pull: { participants: { user: req.user._id } } }
    );

    // Delete user account
    await User.findByIdAndDelete(req.user._id);

    res.json({
      status: 'success',
      message: 'All user data deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 