#!/usr/bin/env node

/**
 * Simple test script for MCP server
 * Uses buffer instead of stream for file upload
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || 'test-api-key';

async function simpleUpload() {
  console.log('🚀 Starting simple MCP Server Test');
  console.log('==================================');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 4)}...`);
  
  // Create a simple test file
  const testFilePath = path.join(__dirname, 'simple-test.txt');
  fs.writeFileSync(testFilePath, 'This is a simple test file for MCP server upload.');
  console.log(`✅ Created test file: ${testFilePath} (${fs.statSync(testFilePath).size} bytes)`);
  
  // Create FormData with buffer instead of stream
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(testFilePath);
  formData.append('file', fileBuffer, {
    filename: 'simple-test.txt',
    contentType: 'text/plain'
  });
  
  console.log('📤 Uploading file...');
  
  try {
    // Make request using fetch
    const response = await fetch(`${SERVER_URL}/api/v1/upload`, {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Upload failed with status ${response.status}: ${errorText}`);
      return;
    }
    
    const result = await response.json();
    
    if (!result.success) {
      console.error(`❌ Upload response indicates failure: ${result.message}`);
      return;
    }
    
    console.log(`✅ File uploaded successfully!`);
    console.log(`   File ID: ${result.data.fileId}`);
    console.log(`   Original name: ${result.data.fileName}`);
    console.log(`   Size: ${result.data.size} bytes`);
    console.log(`   MIME type: ${result.data.mimeType}`);
    console.log(`   Upload date: ${result.data.uploadDate}`);
    console.log(`   Metadata URL: ${result.data.metadataUrl}`);
    
    // Now try to retrieve metadata
    console.log('\n📋 Retrieving metadata...');
    const metadataResponse = await fetch(`${SERVER_URL}/api/v1/metadata/${result.data.fileId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY
      }
    });
    
    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error(`❌ Metadata retrieval failed with status ${metadataResponse.status}: ${errorText}`);
      return;
    }
    
    const metadataResult = await metadataResponse.json();
    console.log(`✅ Metadata retrieved successfully!`);
    console.log(`   File: ${metadataResult.data.fileName}`);
    console.log(`   Uploaded by: ${metadataResult.data.uploadedBy}`);
    console.log(`   Storage URL: ${metadataResult.data.storageUrl}`);
    
    // Cleanup
    fs.unlinkSync(testFilePath);
    console.log(`\n🧹 Cleaned up test file: ${testFilePath}`);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
simpleUpload().catch(console.error);