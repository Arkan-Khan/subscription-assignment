const mongoose = require('mongoose');
const Plan = require('./src/models/Plan');
const path = require('path');

// Debug environment loading
console.log('Current working directory:', process.cwd());
console.log('Looking for .env file at:', path.join(process.cwd(), '.env'));

// Load environment variables
require('dotenv').config();

// Debug loaded environment variables
console.log('Environment variables loaded:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Loaded ✅' : 'Not found ❌');
console.log('REDIS_URL:', process.env.REDIS_URL ? 'Loaded ✅' : 'Not found ❌');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded ✅' : 'Not found ❌');

const samplePlans = [
  {
    name: 'Free',
    price: 0,
    features: [
      'Basic chat functionality',
      'Limited API calls (100/month)',
      'Email support',
      'Basic analytics'
    ],
    duration: 30,
    isActive: true
  },
  {
    name: 'Pro',
    price: 17,
    features: [
      'Unlimited chat',
      'Advanced API access (10,000/month)',
      'Priority support',
      'Custom integrations',
      'Advanced analytics',
      'Team collaboration'
    ],
    duration: 30,
    isActive: true
  },
  {
    name: 'Enterprise',
    price: 100,
    features: [
      'Everything in Pro',
      'Unlimited API calls',
      'Dedicated support manager',
      'Custom deployment options',
      'SLA guarantee (99.9% uptime)',
      'Advanced security features',
      'Custom reporting'
    ],
    duration: 30,
    isActive: true
  }
];

const seedPlans = async () => {
  try {
    // Validate environment variables
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI not found in environment variables');
      console.error('Available environment variables:', Object.keys(process.env).filter(key => !key.includes('PASSWORD')));
      throw new Error('MONGODB_URI environment variable is required');
    }

    console.log('🔄 Connecting to MongoDB...');
    console.log('Connection string preview:', process.env.MONGODB_URI.substring(0, 20) + '...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully');

    // Clear existing plans
    console.log('🗑️  Clearing existing plans...');
    const deleteResult = await Plan.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing plans`);

    // Insert new plans
    console.log('🌱 Seeding new plans...');
    const insertedPlans = await Plan.insertMany(samplePlans);
    console.log(`✅ Successfully seeded ${insertedPlans.length} plans:`);
    
    insertedPlans.forEach(plan => {
      console.log(`   - ${plan.name}: $${plan.price}/month`);
    });

    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding plans:');
    
    if (error.name === 'MongooseError' || error.message.includes('MongoDB')) {
      console.error('   Database connection error:', error.message);
    } else if (error.name === 'ValidationError') {
      console.error('   Data validation error:', error.message);
    } else {
      console.error('   Unexpected error:', error.message);
    }
    
    process.exit(1);
  } finally {
    // Ensure connection is closed
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');
    }
    process.exit(0);
  }
};

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('\n⚠️  Process interrupted. Closing database connection...');
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Process terminated. Closing database connection...');
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

seedPlans();