const mongoose = require('mongoose');

const emissionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  category: {
    type: String,
    enum: ['transport', 'food', 'electricity', 'lifestyle'],
    required: true,
    index: true,
  },
  subcategory: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  unit: {
    type: String,
    required: true,
    enum: ['km', 'kWh', 'kg', 'item'],
  },
  emissionFactor: {
    type: Number,
    required: true,
    min: 0,
  },
  emissionFactorSource: {
    type: String,
    required: true,
  },
  emissionFactorYear: {
    type: Number,
    required: true,
  },
  co2e: {
    type: Number,
    required: true,
    min: 0,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  metadata: {
    transport: {
      vehicleType: String,
      fuelType: String,
      occupancy: Number,
    },
    food: {
      foodType: String,
      productionMethod: String,
      packaging: String,
    },
    electricity: {
      source: String,
      provider: String,
      timeOfUse: String,
    },
    lifestyle: {
      itemType: String,
      material: String,
      disposalMethod: String,
    },
  },
  notes: String,
  tags: [String],
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationSource: String,
  offsetStatus: {
    type: String,
    enum: ['unoffset', 'pending', 'offset'],
    default: 'unoffset',
  },
  offsetProject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OffsetProject',
  },
  offsetDate: Date,
  offsetAmount: Number,
  offsetCertificate: String,
}, {
  timestamps: true,
});

// Indexes
emissionSchema.index({ user: 1, date: -1 });
emissionSchema.index({ category: 1, date: -1 });
emissionSchema.index({ location: '2dsphere' });
emissionSchema.index({ tags: 1 });

// Virtual for formatted date
emissionSchema.virtual('formattedDate').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Pre-save middleware to calculate CO2e
emissionSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('emissionFactor')) {
    this.co2e = this.amount * this.emissionFactor;
  }
  next();
});

// Static methods
emissionSchema.statics.getUserEmissions = function(userId, startDate, endDate) {
  return this.find({
    user: userId,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  }).sort({ date: -1 });
};

emissionSchema.statics.getCategoryEmissions = function(userId, category, startDate, endDate) {
  return this.find({
    user: userId,
    category,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  }).sort({ date: -1 });
};

emissionSchema.statics.getTotalEmissions = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$co2e' },
        byCategory: {
          $push: {
            category: '$category',
            co2e: '$co2e',
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        byCategory: {
          $reduce: {
            input: '$byCategory',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $literal: {
                    $arrayToObject: [
                      {
                        $map: {
                          input: { $filter: { input: '$byCategory', as: 'cat', cond: { $eq: ['$$cat.category', '$$this.category'] } } },
                          as: 'filtered',
                          in: ['$$filtered.category', { $sum: '$$filtered.co2e' }],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
  ]);
};

const Emission = mongoose.model('Emission', emissionSchema);

module.exports = Emission; 