const Plan = require('../models/Plan');
const { redis } = require('../utils/redis');

const CACHE_KEY = 'all_plans';
const CACHE_EXPIRY = 3600;

const getAllPlans = async (req, res) => {
  try {
    // Check Redis cache first
    const cachedPlans = await redis.get(CACHE_KEY);
    if (cachedPlans) {
      try {
        const plans = typeof cachedPlans === 'string' ? JSON.parse(cachedPlans) : cachedPlans;
        console.log('📋 Plans served from Redis cache');
        return res.json({
          success: true,
          message: 'Plans retrieved from cache',
          data: plans
        });
      } catch (parseErr) {
        console.warn('⚠️ Corrupted cache detected, clearing...');
        await redis.del(CACHE_KEY);
      }
    }

    const plans = await Plan.find().sort({ price: 1 });
    const plainPlans = plans.map(plan => plan.toObject());


    await redis.set(CACHE_KEY, JSON.stringify(plainPlans), { ex: CACHE_EXPIRY });
    console.log('💾 Plans cached in Redis');

    res.json({
      success: true,
      message: 'Plans retrieved successfully',
      data: plainPlans
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = { getAllPlans }; 