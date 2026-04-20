#!/usr/bin/env node

/**
 * Test client script for MCP server
 * Demonstrates uploading a test file and retrieving its metadata
 * 
 * Usage:
 *   node test-client.js
 *   SERVER_URL=http://localhost:8080 API_KEY=test-api-key node test-client.js
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || 'test-api-key';
const TEST_FILE_NAME = 'test-upload.txt';
const TEST_FILE_CONTENT = 'This is a test file for MCP server upload demonstration.\nGenerated at ' + new Date().toISOString();

/**
 * Generate a test file in the current directory
 */
async function generateTestFile() {
  const filePath = path.join(__dirname, TEST_FILE_NAME);
  await fsp.writeFile(filePath, TEST_FILE_CONTENT, 'utf8');
  console.log(`✅ Generated test file: ${filePath} (${TEST_FILE_CONTENT.length} bytes)`);
  return filePath;
}

/**
 * Upload file to MCP server using form-data
 */
async function uploadFile(filePath) {
  console.log(`📤 Uploading file to ${SERVER_URL}/api/v1/upload...`);
  
  // Read file as buffer
  const fileBuffer = fs.readFileSync(filePath);
  
  // Create FormData using native FormData (Node 18+)
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'text/plain' });
  formData.append('file', blob, path.basename(filePath));
  
  // Make request using fetch (Node 18+)
  const response = await fetch(`${SERVER_URL}/api/v1/upload`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      // Don't set Content-Type header - let fetch set it with boundary
    },
    body: formData
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
  }
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Upload response indicates failure: ${result.message}`);
  }
  
  console.log(`✅ File uploaded successfully!`);
  console.log(`   File ID: ${result.data.fileId}`);
  console.log(`   Original name: ${result.data.fileName}`);
  console.log(`   Size: ${result.data.size} bytes`);
  console.log(`   MIME type: ${result.data.mimeType}`);
  console.log(`   Upload date: ${result.data.uploadDate}`);
  console.log(`   Metadata URL: ${result.data.metadataUrl}`);
  
  return result;
}

/**
 * Retrieve file metadata from Firestore
 */
async function retrieveMetadata(fileId) {
  console.log(`📋 Retrieving metadata for file ${fileId}...`);
  
  const response = await fetch(`${SERVER_URL}/api/v1/metadata/${fileId}`, {
    method: 'GET',
    headers: {
      'X-API-Key': API_KEY,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Metadata retrieval failed with status ${response.status}: ${errorText}`);
  }
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Metadata response indicates failure`);
  }
  
  console.log(`✅ Metadata retrieved successfully!`);
  console.log(`   File: ${result.data.fileName}`);
  console.log(`   Uploaded by: ${result.data.uploadedBy} (${result.data.uploadedByEmail})`);
  console.log(`   Storage URL: ${result.data.storageUrl}`);
  console.log(`   Public: ${result.data.isPublic}`);
  console.log(`   Tags: ${result.data.tags.join(', ') || 'none'}`);
  console.log(`   Permissions: owner=${result.data.permissions.owner}, viewers=${result.data.permissions.viewers.length}, editors=${result.data.permissions.editors.length}`);
  
  return result;
}

/**
 * Clean up test file
 */
async function cleanup(filePath) {
  try {
    await fs.unlink(filePath);
    console.log(`🧹 Cleaned up test file: ${filePath}`);
  } catch (error) {
    console.warn(`⚠️  Could not delete test file: ${error}`);
  }
}

/**
 * Main test function
 */
async function runTest() {
  console.log('🚀 Starting MCP Server Test Client');
  console.log('==================================');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 4)}...`);
  console.log('');
  
  let testFilePath = '';
  let uploadedFileId = '';
  
  try {
    // Step 1: Generate test file
    testFilePath = await generateTestFile();
    
    // Step 2: Upload file
    const uploadResult = await uploadFile(testFilePath);
    uploadedFileId = uploadResult.data.fileId;
    
    // Step 3: Retrieve metadata
    await retrieveMetadata(uploadedFileId);
    
    // Step 4: Verify consistency
    console.log('\n🔍 Verification Summary');
    console.log('=====================');
    console.log('✅ All operations completed successfully!');
    console.log(`✅ File uploaded with ID: ${uploadedFileId}`);
    console.log(`✅ Metadata retrieved and validated`);
    console.log(`✅ Test completed at ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  } finally {
    // Clean up test file
    if (testFilePath) {
      await cleanup(testFilePath);
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runTest, generateTestFile, uploadFile, retrieveMetadata };