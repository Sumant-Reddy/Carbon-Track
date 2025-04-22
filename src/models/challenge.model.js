const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Challenge title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Challenge description is required'],
  },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'special'],
    required: [true, 'Challenge type is required'],
  },
  category: {
    type: String,
    enum: ['transport', 'food', 'electricity', 'lifestyle', 'general'],
    required: [true, 'Challenge category is required'],
  },
  goal: {
    type: {
      type: String,
      enum: ['emission_reduction', 'offset_purchase', 'habit_formation', 'education'],
      required: [true, 'Goal type is required'],
    },
    target: {
      type: Number,
      required: [true, 'Goal target is required'],
      min: [0, 'Goal target must be a positive number'],
    },
    unit: {
      type: String,
      enum: ['kg_co2e', 'credits', 'days', 'points'],
      required: [true, 'Goal unit is required'],
    },
  },
  duration: {
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
  },
  rewards: {
    points: {
      type: Number,
      required: [true, 'Reward points are required'],
      min: [0, 'Reward points must be a positive number'],
    },
    badges: [{
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
    }],
    carbonCredits: {
      type: Number,
      min: [0, 'Carbon credits must be a positive number'],
    },
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    progress: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'failed'],
      default: 'in_progress',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    completionDate: Date,
    rewards: {
      points: {
        type: Number,
        default: 0,
      },
      badges: [String],
      carbonCredits: {
        type: Number,
        default: 0,
      },
    },
  }],
  requirements: {
    minLevel: {
      type: Number,
      default: 1,
    },
    prerequisites: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
    }],
  },
  tips: [{
    title: String,
    content: String,
    category: String,
  }],
  resources: [{
    title: String,
    url: String,
    type: {
      type: String,
      enum: ['article', 'video', 'calculator', 'tool'],
    },
  }],
  leaderboard: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    score: Number,
    rank: Number,
    lastUpdated: Date,
  }],
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'draft',
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'invite_only'],
    default: 'public',
  },
  tags: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Challenge creator is required'],
  },
}, {
  timestamps: true,
});

// Indexes
challengeSchema.index({ type: 1, status: 1 });
challengeSchema.index({ 'duration.startDate': 1, 'duration.endDate': 1 });
challengeSchema.index({ tags: 1 });

// Virtual for participant count
challengeSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Virtual for completion rate
challengeSchema.virtual('completionRate').get(function() {
  if (this.participants.length === 0) return 0;
  const completed = this.participants.filter(p => p.status === 'completed').length;
  return (completed / this.participants.length) * 100;
});

// Methods
challengeSchema.methods.addParticipant = async function(userId) {
  if (this.participants.some(p => p.user.toString() === userId.toString())) {
    throw new Error('User is already participating in this challenge');
  }

  this.participants.push({
    user: userId,
    progress: 0,
    status: 'in_progress',
    startDate: new Date(),
  });

  return this.save();
};

challengeSchema.methods.updateProgress = async function(userId, progress) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (!participant) {
    throw new Error('User is not participating in this challenge');
  }

  participant.progress = progress;
  if (progress >= this.goal.target) {
    participant.status = 'completed';
    participant.completionDate = new Date();
    participant.rewards = this.rewards;
  }

  return this.save();
};

// Static methods
challengeSchema.statics.findActiveChallenges = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    'duration.startDate': { $lte: now },
    'duration.endDate': { $gte: now },
  }).sort({ 'duration.startDate': 1 });
};

challengeSchema.statics.findUserChallenges = function(userId) {
  return this.find({
    'participants.user': userId,
  }).sort({ 'duration.startDate': -1 });
};

challengeSchema.statics.getLeaderboard = function(challengeId) {
  return this.findById(challengeId)
    .select('leaderboard')
    .populate('leaderboard.user', 'firstName lastName profilePicture')
    .sort({ 'leaderboard.score': -1 })
    .limit(100);
};

const Challenge = mongoose.model('Challenge', challengeSchema);

module.exports = Challenge; 