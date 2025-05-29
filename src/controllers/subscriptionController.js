const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const User = require('../models/User');
const { addEmailJob } = require('../services/queueService');
const mongoose = require('mongoose');

const createSubscription = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.params.userId;

    // Check if userId is valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Check if planId is valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan ID format'
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

    // Check if plan exists and is active
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    if (!plan.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This plan is no longer available'
      });
    }

    // Check if user has any subscription (active, cancelled, or expired)
    const existingSubscription = await Subscription.findOne({ 
      userId,
      status: { $nin: ['EXPIRED'] } // Only allow if all subscriptions are expired
    });
    
    if (existingSubscription) {
      if (existingSubscription.status === 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message: 'User already has an active subscription'
        });
      } else if (existingSubscription.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          message: 'User has a cancelled subscription. Please wait for it to expire or use the reactivate endpoint'
        });
      }
    }

    // Validate plan duration
    if (!plan.duration || plan.duration <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan duration'
      });
    }

    // Calculate end date
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (plan.duration * 24 * 60 * 60 * 1000));

    // Validate calculated dates
    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan duration: End date must be after start date'
      });
    }

    // Create subscription
    const subscription = new Subscription({
      userId,
      planId,
      startDate,
      endDate,
      status: 'ACTIVE'
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
      endDate: endDate.toISOString(),
      price: plan.price,
      features: plan.features
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

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
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

    // Get all subscriptions for the user with proper sorting and population
    const subscriptions = await Subscription.find({ userId })
      .populate('planId')
      .populate('userId', 'name email')
      .sort({ 
        status: 1, // Active first
        startDate: -1 // Most recent first
      });

    // Return empty history if no subscriptions
    if (!subscriptions || subscriptions.length === 0) {
      return res.json({
        success: true,
        message: 'No subscription history found',
        data: {
          currentSubscription: null,
          history: {
            active: null,
            expired: [],
            cancelled: [],
            total: 0
          },
          allSubscriptions: []
        }
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan ID format'
      });
    }

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

    // Check if trying to update to the same plan
    if (subscription.planId.toString() === planId) {
      return res.status(400).json({
        success: false,
        message: 'You are already subscribed to this plan'
      });
    }

    // Get current plan details
    const currentPlan = await Plan.findById(subscription.planId);
    if (!currentPlan) {
      return res.status(400).json({
        success: false,
        message: 'Current plan details not found'
      });
    }

    // Check if new plan exists and is active
    const newPlan = await Plan.findById(planId);
    if (!newPlan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    if (!newPlan.isActive) {
      return res.status(400).json({
        success: false,
        message: 'The requested plan is no longer available'
      });
    }

    // Validate plan duration
    if (!newPlan.duration || newPlan.duration <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan duration'
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate new end date
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (newPlan.duration * 24 * 60 * 60 * 1000));

    // Validate calculated dates
    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan duration: End date must be after start date'
      });
    }

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
      oldPlanName: currentPlan.name,
      newPlanName: newPlan.name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      priceChange: {
        old: currentPlan.price,
        new: newPlan.price,
        difference: newPlan.price - currentPlan.price
      }
    });

    // Get full subscription details for response
    const updatedSubscription = await Subscription.findById(subscription._id)
      .populate('planId')
      .populate('userId', 'name email');

    res.json({
      success: true,
      message: `Subscription updated successfully from ${currentPlan.name} to ${newPlan.name}`,
      data: updatedSubscription
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

    // Find user's subscription and populate plan details
    const subscription = await Subscription.findOne({ 
      userId
    }).populate('planId');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found for this user'
      });
    }

    // Check if subscription is already cancelled or expired
    if (subscription.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is already cancelled'
      });
    }

    if (subscription.status === 'EXPIRED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an expired subscription'
      });
    }

    // Get user details
    const user = await User.findById(userId);

    // Update subscription status
    subscription.status = 'CANCELLED';
    await subscription.save();

    // Add email notification to queue
    await addEmailJob({
      type: 'subscription_cancelled',
      email: user.email,
      name: user.name,
      planName: subscription.planId.name,
      cancelDate: new Date().toISOString(),
      endDate: subscription.endDate.toISOString() // Adding end date to show when service access ends
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully. Service access will continue until ' + subscription.endDate.toISOString(),
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

    // First check if user has any active subscription
    const activeSubscription = await Subscription.findOne({
      userId,
      status: 'ACTIVE'
    });

    if (activeSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reactivate: User already has an active subscription'
      });
    }

    // Find user's cancelled or expired subscription
    const subscription = await Subscription.findOne({ 
      userId,
      status: { $in: ['CANCELLED', 'EXPIRED'] }
    }).populate('planId'); // Populate old plan details

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No cancelled or expired subscription found'
      });
    }

    // Store old plan details for response
    const oldPlan = subscription.planId;
    const oldStatus = subscription.status;

    // Check if plan exists
    const newPlan = await Plan.findById(planId);
    if (!newPlan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Calculate new dates
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (newPlan.duration * 24 * 60 * 60 * 1000));

    // Update subscription
    subscription.planId = planId;
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.status = 'ACTIVE';

    await subscription.save();
    await subscription.populate('planId'); // Populate new plan details

    res.json({
      success: true,
      message: `Subscription reactivated successfully. Changed from ${oldPlan.name} to ${newPlan.name}`,
      data: {
        ...subscription.toObject(),
        previousStatus: oldStatus,
        priceChange: newPlan.price - oldPlan.price
      }
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