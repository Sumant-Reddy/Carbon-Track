const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/user.model');
const logger = require('../utils/logger');

const setupPassport = () => {
  // JWT Strategy
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET,
      },
      async (jwtPayload, done) => {
        try {
          const user = await User.findById(jwtPayload.id);
          if (user) {
            return done(null, user);
          }
          return done(null, false);
        } catch (error) {
          logger.error('JWT Strategy Error:', error);
          return done(error, false);
        }
      }
    )
  );

  // Serialize user for the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      logger.error('Deserialize User Error:', error);
      done(error, null);
    }
  });

  logger.info('Passport strategies configured successfully');
};

module.exports = {
  setupPassport
}; 