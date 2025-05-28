const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const User = require('../models/User');
const { addEmailJob } = require('../services/queueService');

const createSubscription = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.params.userId;

    // Validate required fields
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Check if user has an active subscription
    const existingSubscription = await Subscription.findOne({ 
      userId,
      status: { $nin: ['EXPIRED', 'CANCELLED'] } // Exclude expired and cancelled subscriptions
    });
    
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'User already has an active subscription'
      });
    }

    // Calculate end date
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (plan.duration * 24 * 60 * 60 * 1000));

    // Create subscription
    const subscription = new Subscription({
      userId,
      planId,
      startDate,
      endDate
    });

    await subscription.save();

    // Populate plan details
    await subscription.populate('planId');
    await subscription.populate('userId', 'name email');

    // Add email notification to queue
    await addEmailJob({
      type: 'subscription_created',
      email: user.email,
      name: user.name,
      planName: plan.name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getUserSubscription = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all subscriptions for the user
    const subscriptions = await Subscription.find({ userId })
      .populate('planId')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 }); // Most recent first

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No subscription history found for this user'
      });
    }

    // Find active subscription if exists
    const activeSubscription = subscriptions.find(sub => sub.status === 'ACTIVE');

    // Group subscriptions by status
    const subscriptionHistory = {
      active: activeSubscription || null,
      expired: subscriptions.filter(sub => sub.status === 'EXPIRED'),
      cancelled: subscriptions.filter(sub => sub.status === 'CANCELLED'),
      total: subscriptions.length
    };

    res.json({
      success: true,
      message: 'Subscription history retrieved successfully',
      data: {
        currentSubscription: activeSubscription || null,
        history: subscriptionHistory,
        allSubscriptions: subscriptions
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const updateSubscription = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.params.userId;

    // Find user's active subscription
    const subscription = await Subscription.findOne({ 
      userId,
      status: 'ACTIVE'
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Check if plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Get user details
    const user = await User.findById(userId);

    // Calculate new end date
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (plan.duration * 24 * 60 * 60 * 1000));

    // Update subscription
    subscription.planId = planId;
    subscription.startDate = startDate;
    subscription.endDate = endDate;

    await subscription.save();

    // Add email notification to queue
    await addEmailJob({
      type: 'subscription_updated',
      email: user.email,
      name: user.name,
      planName: plan.name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find user's active subscription
    const subscription = await Subscription.findOne({ 
      userId,
      status: 'ACTIVE'
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Get user and plan details
    const user = await User.findById(userId);
    const plan = await Plan.findById(subscription.planId);

    // Update subscription status
    subscription.status = 'CANCELLED';
    await subscription.save();

    // Add email notification to queue
    await addEmailJob({
      type: 'subscription_cancelled',
      email: user.email,
      name: user.name,
      planName: plan.name,
      cancelDate: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const reactivateSubscription = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.params.userId;

    // Find user's cancelled or expired subscription
    const subscription = await Subscription.findOne({ 
      userId,
      status: { $in: ['CANCELLED', 'EXPIRED'] }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No cancelled or expired subscription found'
      });
    }

    // Check if plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Get user details
    const user = await User.findById(userId);

    // Calculate new dates
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (plan.duration * 24 * 60 * 60 * 1000));

    // Update subscription
    subscription.planId = planId;
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.status = 'ACTIVE';

    await subscription.save();

    // Add email notification to queue
    await addEmailJob({
      type: 'subscription_created',
      email: user.email,
      name: user.name,
      planName: plan.name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    res.json({
      success: true,
      message: 'Subscription reactivated successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createSubscription,
  getUserSubscription,
  updateSubscription,
  cancelSubscription,
  reactivateSubscription
}; 