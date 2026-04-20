#!/usr/bin/env node

/**
 * Test metadata retrieval
 */

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || 'test-api-key';

// File ID from successful upload
const FILE_ID = '23669c7f-e215-4959-8c96-a3854513bf1c';

async function testMetadata() {
  console.log('🚀 Testing MCP Server Metadata Retrieval');
  console.log('==========================================');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`File ID: ${FILE_ID}`);
  
  console.log('\n📋 Retrieving metadata...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/v1/metadata/${FILE_ID}`, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY
      }
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Metadata retrieval failed: ${errorText}`);
      
      // Try to get more details
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      return;
    }
    
    const result = await response.json();
    console.log(`✅ Metadata retrieved successfully!`);
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testMetadata().catch(console.error);