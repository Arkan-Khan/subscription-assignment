const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./utils/database');
const { client } = require('./utils/redis');
const { scheduleExpirationChecks } = require('./services/subscriptionService');

// Import routes
const authRoutes = require('./routes/auth');
const planRoutes = require('./routes/plans');
const subscriptionRoutes = require('./routes/subscriptions');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Subscription API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Initialize connections
const initializeApp = async () => {
  try {
    await connectDB();
    scheduleExpirationChecks();
    console.log('✅ All connections established');
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    process.exit(1);
  }
};

module.exports = { app, initializeApp }; 