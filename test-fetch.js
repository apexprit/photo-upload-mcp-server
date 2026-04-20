#!/usr/bin/env node

/**
 * Test using native fetch with simpler approach
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || 'test-api-key';

async function testUpload() {
  console.log('🚀 Testing MCP Server with native fetch');
  console.log('========================================');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 4)}...`);
  
  // Create a simple test file
  const testFilePath = path.join(__dirname, 'fetch-test.txt');
  fs.writeFileSync(testFilePath, 'Test file content for fetch upload.');
  console.log(`✅ Created test file: ${testFilePath}`);
  
  // Read file as buffer
  const fileBuffer = fs.readFileSync(testFilePath);
  
  // Create FormData using native FormData (Node 18+)
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'text/plain' });
  formData.append('file', blob, 'fetch-test.txt');
  
  console.log('📤 Uploading file...');
  
  try {
    // Make request using fetch
    const response = await fetch(`${SERVER_URL}/api/v1/upload`, {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        // Don't set Content-Type header - let fetch set it with boundary
      },
      body: formData
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Upload failed: ${errorText}`);
      
      // Try to get more details
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      return;
    }
    
    const result = await response.json();
    console.log(`✅ Upload successful!`);
    console.log('Result:', JSON.stringify(result, null, 2));
    
    // Cleanup
    fs.unlinkSync(testFilePath);
    console.log(`\n🧹 Cleaned up test file`);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testUpload().catch(console.error);