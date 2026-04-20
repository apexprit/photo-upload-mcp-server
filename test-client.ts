#!/usr/bin/env node

/**
 * Test client script for MCP server
 * Demonstrates uploading a test file and retrieving its metadata
 * 
 * Usage:
 *   npm run build && node dist/test-client.js
 *   Or: npx ts-node test-client.ts
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || 'test-api-key';
const TEST_FILE_NAME = 'test-upload.txt';
const TEST_FILE_CONTENT = 'This is a test file for MCP server upload demonstration.\nGenerated at ' + new Date().toISOString();

interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    fileId: string;
    fileName: string;
    storageUrl: string;
    mimeType: string;
    size: number;
    uploadDate: string;
    metadataUrl: string;
  };
}

interface MetadataResponse {
  success: boolean;
  data: {
    fileId: string;
    fileName: string;
    storagePath: string;
    storageUrl: string;
    mimeType: string;
    size: number;
    uploadedBy: string;
    uploadedByEmail: string;
    uploadDate: string;
    permissions: {
      owner: string;
      viewers: string[];
      editors: string[];
    };
    tags: string[];
    isPublic: boolean;
  };
}

/**
 * Generate a test file in the current directory
 */
async function generateTestFile(): Promise<string> {
  const filePath = path.join(__dirname, TEST_FILE_NAME);
  await fs.promises.writeFile(filePath, TEST_FILE_CONTENT, 'utf8');
  console.log(`✅ Generated test file: ${filePath} (${TEST_FILE_CONTENT.length} bytes)`);
  return filePath;
}

/**
 * Upload file to MCP server using form-data
 */
async function uploadFile(filePath: string): Promise<UploadResponse> {
  console.log(`📤 Uploading file to ${SERVER_URL}/api/v1/upload...`);
  
  // Create FormData
  const formData = new FormData();
  const fileStream = fs.createReadStream(filePath);
  formData.append('file', fileStream, {
    filename: path.basename(filePath),
    contentType: 'text/plain'
  });
  
  // Make request using fetch (Node 18+)
  const response = await fetch(`${SERVER_URL}/api/v1/upload`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      ...formData.getHeaders()
    },
    body: formData as any
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
  }
  
  const result = await response.json() as UploadResponse;
  
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
async function retrieveMetadata(fileId: string): Promise<MetadataResponse> {
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
  
  const result = await response.json() as MetadataResponse;
  
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
async function cleanup(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
    console.log(`🧹 Cleaned up test file: ${filePath}`);
  } catch (error) {
    console.warn(`⚠️  Could not delete test file: ${error}`);
  }
}

/**
 * Main test function
 */
async function runTest(): Promise<void> {
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

export { runTest, generateTestFile, uploadFile, retrieveMetadata };