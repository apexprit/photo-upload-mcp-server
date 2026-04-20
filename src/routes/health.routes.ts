import { Router } from 'express';
import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';

const router = Router();

/**
 * @route GET /health
 * @desc Basic health check endpoint
 * @access Public
 */
router.get('/', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Google Cloud MCP Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * @route GET /health/readiness
 * @desc Readiness probe for Kubernetes/Cloud Run
 * @access Public
 */
router.get('/readiness', async (_req, res) => {
  const checks: Record<string, { status: string; details?: any }> = {};
  
  try {
    // Check Firestore connection
    if (admin.apps.length > 0) {
      const firestore = admin.firestore();
      await firestore.collection('health').doc('check').get();
      checks.firestore = { status: 'healthy' };
    } else {
      checks.firestore = { status: 'unavailable', details: 'Firebase Admin not initialized' };
    }
  } catch (error) {
    checks.firestore = { status: 'unhealthy', details: (error as Error).message };
  }

  try {
    // Check Cloud Storage connection
    if (process.env.CLOUD_STORAGE_BUCKET_NAME) {
      const storage = new Storage();
      const [buckets] = await storage.getBuckets();
      checks.storage = { status: 'healthy', details: { bucketCount: buckets.length } };
    } else {
      checks.storage = { status: 'unavailable', details: 'No bucket configured' };
    }
  } catch (error) {
    checks.storage = { status: 'unhealthy', details: (error as Error).message };
  }

  // Check environment variables
  const requiredEnvVars = ['GOOGLE_CLOUD_PROJECT_ID', 'CLOUD_STORAGE_BUCKET_NAME'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  checks.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'degraded',
    details: {
      missing: missingEnvVars,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? 'set' : 'missing',
      bucketName: process.env.CLOUD_STORAGE_BUCKET_NAME ? 'set' : 'missing'
    }
  };

  // Determine overall status
  const allHealthy = Object.values(checks).every(check => check.status === 'healthy' || check.status === 'unavailable');
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
    checks
  });
});

/**
 * @route GET /health/liveness
 * @desc Liveness probe for Kubernetes/Cloud Run
 * @access Public
 */
router.get('/liveness', (_req, res) => {
  // Simple check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage()
  });
});

/**
 * @route GET /health/version
 * @desc Get service version information
 * @access Public
 */
router.get('/version', (_req, res) => {
  res.json({
    service: 'Google Cloud MCP Server',
    version: '1.0.0',
    apiVersion: 'v1',
    build: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    endpoints: {
      upload: '/api/v1/upload',
      metadata: '/api/v1/metadata',
      health: '/health'
    }
  });
});

export default router;