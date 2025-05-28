// Test script for Email Queue Worker
// Run with: node test-email-worker.js

const UPSTASH_URL = 'https://allowing-woodcock-14002.upstash.io';
const UPSTASH_TOKEN = 'ATayAAIjcDE4M2E3NzQwNDkzYjA0MmE1OWE4OTkxN2MyMTdmYTFiMHAxMA';
const WORKER_URL = 'https://claude.arkankhan051.workers.dev/';

// 🔧 CONFIGURATION - Change this to your email!
const TEST_EMAIL = 'arkankhan051@gmail.com'; // ⚠️ CHANGE THIS TO YOUR REAL EMAIL
const TEST_USER_NAME = 'Test User';

// Helper function to make HTTP requests
async function makeRequest(url, options = {}) {
    try {
        console.log(`📡 Making request to: ${url}`);
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
        }
        
        return { success: true, data, status: response.status };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Add event to Upstash Redis queue
async function addEventToQueue(eventType = 'user_signup', email = TEST_EMAIL, name = TEST_USER_NAME, planName = null) {
    const event = {
        type: eventType,
        email: email,
        name: name,
        timestamp: new Date().toISOString()
    };
    
    if (planName) {
        event.planName = planName;
    }
    
    console.log(`\n🎯 Adding ${eventType} event to queue...`);
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Name: ${name}`);
    
    const result = await makeRequest(`${UPSTASH_URL}/lpush/subscription_events`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify([JSON.stringify(event)])
    });
    
    if (result.success) {
        console.log(`✅ Event added successfully! Queue length: ${result.data.result}`);
        return true;
    } else {
        console.log(`❌ Failed to add event: ${result.error}`);
        return false;
    }
}

// Check queue length
async function checkQueueLength() {
    console.log('\n📊 Checking queue length...');
    
    const result = await makeRequest(`${UPSTASH_URL}/llen/subscription_events`, {
        headers: {
            'Authorization': `Bearer ${UPSTASH_TOKEN}`
        }
    });
    
    if (result.success) {
        const queueLength = result.data.result;
        console.log(`📋 Queue length: ${queueLength} events`);
        return queueLength;
    } else {
        console.log(`❌ Failed to check queue: ${result.error}`);
        return -1;
    }
}

// Process queue by calling the worker
async function processQueue() {
    console.log('\n⚡ Processing email queue...');
    
    const result = await makeRequest(WORKER_URL);
    
    if (result.success) {
        const { processed, successful, failed, processingTimeMs } = result.data;
        console.log(`✅ Queue processed successfully!`);
        console.log(`📊 Processed: ${processed} | Successful: ${successful} | Failed: ${failed}`);
        console.log(`⏱️  Processing time: ${processingTimeMs}ms`);
        
        if (successful > 0) {
            console.log(`📧 ${successful} email(s) should be sent! Check your inbox.`);
        } else if (processed === 0) {
            console.log(`ℹ️  No events in queue to process.`);
        }
        
        return result.data;
    } else {
        console.log(`❌ Failed to process queue: ${result.error}`);
        return null;
    }
}

// Main test function
async function runTest() {
    console.log('🧪 Starting Email Worker Test');
    console.log('================================');
    
    // Check if user updated the email
    if (TEST_EMAIL === 'your-email@example.com') {
        console.log('⚠️  WARNING: Please update TEST_EMAIL in the script to your real email address!');
        console.log('   Change line: const TEST_EMAIL = \'your-email@example.com\';');
        console.log('   To:         const TEST_EMAIL = \'your-actual-email@gmail.com\';');
        console.log('');
        console.log('⏭️  Continuing with test email for demo purposes...');
    }
    
    try {
        // Step 1: Check initial queue length
        const initialQueueLength = await checkQueueLength();
        
        // Step 2: Add a signup event
        const eventAdded = await addEventToQueue('user_signup', TEST_EMAIL, TEST_USER_NAME);
        
        if (!eventAdded) {
            console.log('\n❌ Test failed: Could not add event to queue');
            return;
        }
        
        // Step 3: Verify queue length increased
        const newQueueLength = await checkQueueLength();
        
        if (newQueueLength > initialQueueLength) {
            console.log(`✅ Queue length increased from ${initialQueueLength} to ${newQueueLength}`);
        }
        
        // Step 4: Process the queue
        const processResult = await processQueue();
        
        if (processResult && processResult.successful > 0) {
            console.log('\n🎉 TEST COMPLETED SUCCESSFULLY!');
            console.log('📧 Check your email inbox for the welcome email.');
            console.log('📁 Also check your spam/junk folder if you don\'t see it.');
        } else if (processResult && processResult.processed === 0) {
            console.log('\n⚠️  No events were processed. The queue might be empty.');
        } else {
            console.log('\n❌ Test completed but emails may not have been sent.');
        }
        
        // Step 5: Final queue check
        await checkQueueLength();
        
    } catch (error) {
        console.log(`\n❌ Test failed with error: ${error.message}`);
    }
}

// Additional test functions
async function testMultipleEvents() {
    console.log('\n🔄 Testing multiple event types...');
    
    const events = [
        { type: 'user_signup', email: TEST_EMAIL, name: 'John Doe' },
        { type: 'user_subscribed', email: TEST_EMAIL, name: 'John Doe', planName: 'Pro Plan' },
        { type: 'user_upgraded', email: TEST_EMAIL, name: 'John Doe', planName: 'Premium Plan' }
    ];
    
    for (const event of events) {
        await addEventToQueue(event.type, event.email, event.name, event.planName);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    }
    
    console.log('\n⚡ Processing all events...');
    await processQueue();
}

// Check if this is run directly
if (require.main === module) {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Email Worker Test Script');
        console.log('========================');
        console.log('');
        console.log('Usage:');
        console.log('  node test-email-worker.js           # Run basic signup test');
        console.log('  node test-email-worker.js --multi   # Test multiple event types');
        console.log('  node test-email-worker.js --queue   # Just check queue status');
        console.log('  node test-email-worker.js --process # Just process queue');
        console.log('');
        console.log('Before running, update TEST_EMAIL constant with your real email!');
        process.exit(0);
    }
    
    if (args.includes('--multi')) {
        testMultipleEvents();
    } else if (args.includes('--queue')) {
        checkQueueLength();
    } else if (args.includes('--process')) {
        processQueue();
    } else {
        runTest();
    }
}

// Export functions for use in other scripts
module.exports = {
    addEventToQueue,
    checkQueueLength,
    processQueue,
    testMultipleEvents
};