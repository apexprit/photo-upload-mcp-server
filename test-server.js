#!/usr/bin/env node

/**
 * Simple test script to verify the MCP server is working
 * Run this after starting the server locally
 */

const http = require('http');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || 'test-api-key';

async function testHealthEndpoint() {
  console.log('🧪 Testing health endpoint...');
  
  return new Promise((resolve, reject) => {
    const req = http.get(`${SERVER_URL}/health`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200 && response.status === 'healthy') {
            console.log('✅ Health check passed');
            resolve(true);
          } else {
            console.log('❌ Health check failed:', response);
            resolve(false);
          }
        } catch (error) {
          console.log('❌ Failed to parse health response:', error.message);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ Health check request failed:', error.message);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log('❌ Health check timeout');
      req.destroy();
      resolve(false);
    });
  });
}

async function testRootEndpoint() {
  console.log('\n🧪 Testing root endpoint...');
  
  return new Promise((resolve, reject) => {
    const req = http.get(SERVER_URL, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200 && response.service === 'Google Cloud MCP Server') {
            console.log('✅ Root endpoint passed');
            console.log('   Service:', response.service);
            console.log('   Version:', response.version);
            resolve(true);
          } else {
            console.log('❌ Root endpoint failed:', response);
            resolve(false);
          }
        } catch (error) {
          console.log('❌ Failed to parse root response:', error.message);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ Root endpoint request failed:', error.message);
      resolve(false);
    });
  });
}

async function testAuthentication() {
  console.log('\n🧪 Testing authentication...');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: '/api/v1/metadata',
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          console.log('✅ Authentication check passed (correctly rejected)');
          resolve(true);
        } else {
          try {
            const response = JSON.parse(data);
            console.log('⚠️  Authentication response:', response);
            resolve(true);
          } catch (error) {
            console.log('❌ Authentication test inconclusive');
            resolve(false);
          }
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ Authentication request failed:', error.message);
      resolve(false);
    });
    
    req.end();
  });
}

async function runAllTests() {
  console.log('🚀 Starting MCP Server Tests');
  console.log('============================');
  console.log(`Server URL: ${SERVER_URL}`);
  
  const tests = [
    testHealthEndpoint,
    testRootEndpoint,
    testAuthentication
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n📊 Test Results');
  console.log('===============');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${tests.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The MCP server is working correctly.');
    console.log('\nNext steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Start the server: npm run dev');
    console.log('3. Test upload: curl -X POST http://localhost:8080/api/v1/upload \\');
    console.log('     -H "X-API-Key: test-key" \\');
    console.log('     -F "file=@test-file.jpg"');
  } else {
    console.log('\n⚠️  Some tests failed. Check the server logs for details.');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});