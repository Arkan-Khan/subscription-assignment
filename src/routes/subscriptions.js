const express = require('express');
const router = express.Router();
const {
  createSubscription,
  getUserSubscription,
  updateSubscription,
  cancelSubscription,
  reactivateSubscription
} = require('../controllers/subscriptionController');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { 
  createSubscriptionSchema, 
  updateSubscriptionSchema,
  reactivateSubscriptionSchema 
} = require('../validations/schemas');

router.post('/:userId', auth, validate(createSubscriptionSchema), createSubscription);
router.get('/:userId', auth, getUserSubscription);
router.put('/:userId', auth, validate(updateSubscriptionSchema), updateSubscription);
router.delete('/:userId', auth, cancelSubscription);
router.post('/:userId/reactivate', auth, validate(reactivateSubscriptionSchema), reactivateSubscription);

module.exports = router; 