const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Plan = require('../models/Plan');
const { addEmailJob } = require('./queueService');

// Function to check and update expired subscriptions
const checkAndUpdateExpiredSubscriptions = async () => {
  try {
    console.log('🔍 Checking for expired subscriptions...');
    const now = new Date();

    // Find all active subscriptions that have passed their end date
    const expiredSubscriptions = await Subscription.find({
      status: 'ACTIVE',
      endDate: { $lt: now }
    }).populate('userId').populate('planId');

    if (expiredSubscriptions.length === 0) {
      console.log('✅ No expired subscriptions found');
      return;
    }

    // Update all expired subscriptions and send notifications
    for (const subscription of expiredSubscriptions) {
      // Update subscription status
      subscription.status = 'EXPIRED';
      await subscription.save();

      // Send email notification
      await addEmailJob({
        type: 'subscription_expired',
        email: subscription.userId.email,
        name: subscription.userId.name,
        planName: subscription.planId.name,
        expiryDate: subscription.endDate.toISOString()
      });
    }

    console.log(`✅ Updated ${expiredSubscriptions.length} expired subscriptions`);
  } catch (error) {
    console.error('❌ Error checking expired subscriptions:', error);
  }
};

// Schedule the expiration check to run every 30 seconds for testing
const scheduleExpirationChecks = () => {
  // Run every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    console.log('⏰ Running scheduled subscription expiration check');
    await checkAndUpdateExpiredSubscriptions();
  });

  // Run immediately on startup
  checkAndUpdateExpiredSubscriptions();
};

module.exports = {
  scheduleExpirationChecks,
  checkAndUpdateExpiredSubscriptions
}; 