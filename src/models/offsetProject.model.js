const mongoose = require('mongoose');

const offsetProjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['reforestation', 'renewable_energy', 'methane_capture', 'soil_carbon', 'ocean_conservation'],
    required: true,
    index: true,
  },
  location: {
    country: {
      type: String,
      required: true,
    },
    region: String,
    coordinates: {
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
  },
  developer: {
    name: {
      type: String,
      required: true,
    },
    website: String,
    certification: [String],
  },
  certification: {
    standard: {
      type: String,
      required: true,
      enum: ['VCS', 'Gold Standard', 'CDM', 'CAR', 'ACR'],
    },
    registry: String,
    projectId: String,
  },
  timeline: {
    startDate: {
      type: Date,
      required: true,
    },
    endDate: Date,
    duration: Number, // in years
  },
  carbonCredits: {
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    issued: {
      type: Number,
      default: 0,
      min: 0,
    },
    retired: {
      type: Number,
      default: 0,
      min: 0,
    },
    pricePerTon: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  environmentalImpact: {
    co2Reduction: {
      type: Number,
      required: true,
      min: 0,
    },
    biodiversityImpact: String,
    waterConservation: String,
    socialImpact: String,
  },
  images: [{
    url: String,
    caption: String,
    type: {
      type: String,
      enum: ['main', 'gallery', 'documentation'],
    },
  }],
  documents: [{
    title: String,
    url: String,
    type: {
      type: String,
      enum: ['certification', 'report', 'audit', 'other'],
    },
    date: Date,
  }],
  status: {
    type: String,
    enum: ['active', 'completed', 'suspended', 'planned'],
    default: 'active',
    index: true,
  },
  verificationReports: [{
    date: Date,
    verifier: String,
    reportUrl: String,
    findings: String,
  }],
  socialMedia: {
    website: String,
    twitter: String,
    facebook: String,
    instagram: String,
    linkedin: String,
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: String,
    date: {
      type: Date,
      default: Date.now,
    },
  }],
  averageRating: {
    type: Number,
    default: 0,
  },
  totalReviews: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Indexes
offsetProjectSchema.index({ 'location.coordinates': '2dsphere' });
offsetProjectSchema.index({ type: 1, status: 1 });
offsetProjectSchema.index({ 'carbonCredits.pricePerTon': 1 });

// Pre-save middleware to update average rating
offsetProjectSchema.pre('save', function(next) {
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.averageRating = totalRating / this.reviews.length;
    this.totalReviews = this.reviews.length;
  }
  next();
});

// Static methods
offsetProjectSchema.statics.findActiveProjects = function() {
  return this.find({ status: 'active' })
    .sort({ 'carbonCredits.pricePerTon': 1 });
};

offsetProjectSchema.statics.findProjectsByType = function(type) {
  return this.find({ type, status: 'active' })
    .sort({ 'carbonCredits.pricePerTon': 1 });
};

offsetProjectSchema.statics.findProjectsByLocation = function(country) {
  return this.find({
    'location.country': country,
    status: 'active',
  }).sort({ 'carbonCredits.pricePerTon': 1 });
};

offsetProjectSchema.statics.getProjectStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$type',
        totalProjects: { $sum: 1 },
        totalCredits: { $sum: '$carbonCredits.total' },
        averagePrice: { $avg: '$carbonCredits.pricePerTon' },
        totalReduction: { $sum: '$environmentalImpact.co2Reduction' },
      },
    },
  ]);
};

const OffsetProject = mongoose.model('OffsetProject', offsetProjectSchema);

module.exports = OffsetProject; 