const { z } = require('zod');

// User validation schemas
const userSignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters long')
});

const userLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

// Plan validation schema
const planSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters long'),
  price: z.number().min(0, 'Price must be a positive number'),
  features: z.array(z.string()),
  duration: z.number().min(1, 'Duration must be at least 1 day')
});

// Subscription validation schemas
const createSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required')
});

const updateSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required')
});

const reactivateSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required')
});

module.exports = {
  userSignupSchema,
  userLoginSchema,
  planSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  reactivateSubscriptionSchema
}; 