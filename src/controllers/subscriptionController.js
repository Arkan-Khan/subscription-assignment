const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const User = require('../models/User');

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

    // Check if user already has a subscription
    const existingSubscription = await Subscription.findOne({ userId });
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'User already has a subscription'
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

    const subscription = await Subscription.findOne({ userId })
      .populate('planId')
      .populate('userId', 'name email');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found for this user'
      });
    }

    // Check if subscription has expired
    const now = new Date();
    if (subscription.status === 'ACTIVE' && now > subscription.endDate) {
      subscription.status = 'EXPIRED';
      await subscription.save();
    }

    res.json({
      success: true,
      message: 'Subscription retrieved successfully',
      data: subscription
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
    const { userId } = req.params;
    const { planId } = req.body;

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

    // Find subscription
    const subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found for this user'
      });
    }

    // Check if subscription can be updated
    if (subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update cancelled or expired subscription'
      });
    }

    // Update subscription
    subscription.planId = planId;
    
    // Recalculate end date based on new plan duration
    const now = new Date();
    subscription.endDate = new Date(now.getTime() + (plan.duration * 24 * 60 * 60 * 1000));
    subscription.status = 'ACTIVE';

    await subscription.save();

    // Populate plan details
    await subscription.populate('planId');
    await subscription.populate('userId', 'name email');

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
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find subscription
    const subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found for this user'
      });
    }

    // Check if already cancelled
    if (subscription.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is already cancelled'
      });
    }

    // Cancel subscription
    subscription.status = 'CANCELLED';
    await subscription.save();

    // Populate plan details
    await subscription.populate('planId');
    await subscription.populate('userId', 'name email');

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
    const { userId } = req.params;
    const { planId } = req.body;

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

    // Find subscription
    const subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found for this user'
      });
    }

    // Check if subscription is cancelled
    if (subscription.status !== 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Only cancelled subscriptions can be reactivated'
      });
    }

    // Calculate new end date based on plan duration
    const now = new Date();
    const endDate = new Date(now.getTime() + (plan.duration * 24 * 60 * 60 * 1000));

    // Update subscription
    subscription.planId = planId;
    subscription.status = 'ACTIVE';
    subscription.startDate = now;
    subscription.endDate = endDate;

    await subscription.save();

    // Populate plan details
    await subscription.populate('planId');
    await subscription.populate('userId', 'name email');

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