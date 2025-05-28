const { Redis } = require('@upstash/redis');
const axios = require('axios');

// Create Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Queue names
const EMAIL_QUEUE = 'email_queue';
const PROCESSING_QUEUE = 'email_processing';

// Function to add job to queue
const addEmailJob = async (data) => {
  try {
    // Generate a unique job ID
    const jobId = `email_job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Create job data
    const jobData = {
      id: jobId,
      ...data,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString()
    };

    // Store job data
    await redis.set(`job:${jobId}`, jobData);
    
    // Add job to FIFO queue
    await redis.rpush(EMAIL_QUEUE, jobId);

    console.log('✉️ Email job added to queue:', jobId);

    // Start processing if not already running
    startQueueProcessing();
  } catch (error) {
    console.error('Error adding email job to queue:', error);
  }
};

// Flag to track if queue processor is running
let isProcessing = false;

// Function to start queue processing
const startQueueProcessing = async () => {
  if (isProcessing) return;
  isProcessing = true;
  processQueue().catch(console.error);
};

// Main queue processing loop
const processQueue = async () => {
  try {
    while (true) {
      // Move job from waiting queue to processing queue (atomic operation)
      const jobId = await redis.lpop(EMAIL_QUEUE);
      
      if (!jobId) {
        // No more jobs to process
        isProcessing = false;
        break;
      }

      // Get job data
      const jobData = await redis.get(`job:${jobId}`);
      if (!jobData) {
        console.error('Job data not found:', jobId);
        continue;
      }

      // Process the job
      await processEmailJob(jobData);

      // Small delay to prevent overwhelming the worker
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('Queue processing error:', error);
    isProcessing = false;
  }
};

// Function to process individual email job
const processEmailJob = async (job) => {
  try {
    // Update job status
    job.status = 'processing';
    job.attempts += 1;
    await redis.set(`job:${job.id}`, job);

    // Send email via Cloudflare Worker
    const response = await axios.post('https://claude.arkankhan051.workers.dev/', {
      type: job.type,
      email: job.email,
      name: job.name,
      planName: job.planName,
      startDate: job.startDate,
      endDate: job.endDate,
      cancelDate: job.cancelDate,
      expiryDate: job.expiryDate
    });

    if (response.data.success) {
      // Job completed successfully
      job.status = 'completed';
      await redis.set(`job:${job.id}`, job);
      console.log('✅ Email sent successfully:', job.id);

      // Set expiry on completed job data (24 hours)
      await redis.expire(`job:${job.id}`, 24 * 60 * 60);
    } else {
      throw new Error(response.data.message || 'Failed to send email');
    }
  } catch (error) {
    console.error('Error processing email job:', error);
    
    // Handle retries
    if (job.attempts < job.maxAttempts) {
      // Put job back in queue for retry
      job.status = 'waiting';
      await redis.set(`job:${job.id}`, job);
      await redis.rpush(EMAIL_QUEUE, job.id);
      console.log('⏳ Job scheduled for retry:', job.id);
    } else {
      // Max attempts reached
      job.status = 'failed';
      job.error = error.message;
      await redis.set(`job:${job.id}`, job);
      console.error('❌ Job failed permanently:', job.id);
    }
  }
};

module.exports = {
  addEmailJob
}; 