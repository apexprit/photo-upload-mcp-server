# Google Cloud MCP Server

A minimal Cloud Run-based MCP (Media Content Platform) server prototype implementing file upload, metadata storage in Firestore, and permission validation.

## Features

- **File Upload Endpoint**: REST API for uploading files to Google Cloud Storage
- **Metadata Storage**: File metadata stored in Firestore with rich schema
- **Permission Validation**: Role-based and resource-based permission system
- **Authentication**: Multiple auth methods (API Key, JWT, Service Account)
- **Health Checks**: Ready for Kubernetes/Cloud Run health probes
- **Cloud Native**: Designed for Google Cloud Run with auto-scaling

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │───▶│   Cloud Run     │───▶│   Cloud Storage │
│   (Web/Mobile)  │    │   MCP Server    │    │   (Files)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │    Firestore    │
                       │   (Metadata)    │
                       └─────────────────┘
```

## API Endpoints

### File Upload
- `POST /api/v1/upload` - Upload a file with metadata
- `GET /api/v1/upload/presigned-url` - Generate presigned URL for direct upload

### Metadata Management
- `GET /api/v1/metadata` - List files with pagination
- `GET /api/v1/metadata/:fileId` - Get file metadata
- `PUT /api/v1/metadata/:fileId` - Update file metadata
- `DELETE /api/v1/metadata/:fileId` - Delete file metadata
- `PUT /api/v1/metadata/:fileId/permissions` - Update permissions
- `POST /api/v1/metadata/:fileId/share` - Share file with user

### Health & Monitoring
- `GET /health` - Basic health check
- `GET /health/readiness` - Readiness probe
- `GET /health/liveness` - Liveness probe
- `GET /health/version` - Service version info

## Authentication

The server supports multiple authentication methods:

1. **API Key**: `X-API-Key: <your-api-key>`
2. **JWT Token**: `Authorization: Bearer <your-jwt-token>`
3. **Service Account**: `X-Service-Account: <service-account-id>`

## Quick Start

### Prerequisites

- Node.js 18+
- Google Cloud SDK (`gcloud`)
- Docker
- Google Cloud Project with billing enabled

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   cd mcp-server
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. The server will be available at `http://localhost:8080`

### Testing

```bash
# Run tests
npm test

# Test health endpoint
curl http://localhost:8080/health

# Test upload (with authentication)
curl -X POST http://localhost:8080/api/v1/upload \
  -H "X-API-Key: test-key" \
  -F "file=@/path/to/your/file.jpg"
```

## Test Client Script

A comprehensive test client script is included to demonstrate uploading a test file and retrieving its metadata. The script performs the following steps:

1. **Generates a test file** with sample content
2. **Uploads the file** to the MCP server via `/api/v1/upload`
3. **Verifies the upload** was successful (checks response)
4. **Retrieves file metadata** from Firestore via `/api/v1/metadata/{fileId}`
5. **Prints the results** with detailed console output

### Usage

```bash
# Ensure the MCP server is running (default: http://localhost:8080)
npm run dev

# In another terminal, run the test client
npm run test:client

# Or run directly with custom environment variables
SERVER_URL=http://localhost:8080 API_KEY=test-api-key node test-client.js
```

### Script Options

The script uses environment variables for configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_URL` | URL of the MCP server | `http://localhost:8080` |
| `API_KEY` | API key for authentication | `test-api-key` |

### Expected Output

The script provides detailed console output showing each step's progress, success/failure status, and the retrieved metadata. On successful completion, you'll see a verification summary confirming all operations succeeded.

### Source Files

- **TypeScript version**: `test-client.ts` (can be run with `ts-node`)
- **JavaScript version**: `test-client.js` (can be run directly with Node.js)

Both scripts are located in the `mcp-server` directory.

## Deployment to Google Cloud Run

### Manual Deployment

1. Build and push Docker image:
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/mcp-server
   ```

2. Deploy to Cloud Run:
   ```bash
   gcloud run deploy mcp-server \
     --image gcr.io/PROJECT_ID/mcp-server \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=PROJECT_ID"
   ```

### Using Deployment Script

```bash
# Make script executable
chmod +x deploy.sh

# Deploy to Cloud Run
./deploy.sh
```

### CI/CD with Cloud Build

1. Connect your repository to Cloud Build
2. Push changes to trigger automatic deployment:
   ```bash
   git push origin main
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8080 |
| `NODE_ENV` | Environment (development/production) | development |
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud Project ID | - |
| `CLOUD_STORAGE_BUCKET_NAME` | Cloud Storage bucket name | - |
| `CORS_ORIGIN` | Allowed CORS origins | * |
| `API_KEY_SECRET` | Secret for API key validation | - |
| `JWT_SECRET` | Secret for JWT validation | - |

### Firestore Schema

The server uses the following Firestore collections:

- `files`: File metadata and permissions
- `users`: User information and roles
- `api_keys`: API key management
- `audit_logs`: Audit trail for all operations

### Cloud Storage Structure

Files are stored with the following structure:
```
uploads/{userId}/{timestamp}-{filename}
```

## Security Considerations

1. **Authentication**: All API endpoints require authentication
2. **Authorization**: Role-based and resource-based permission checks
3. **Input Validation**: All inputs are validated and sanitized
4. **Rate Limiting**: Built-in rate limiting to prevent abuse
5. **Audit Logging**: All operations are logged for security auditing

## Monitoring

The server includes built-in monitoring:

1. **Health endpoints** for Kubernetes/Cloud Run
2. **Structured logging** for Cloud Logging
3. **Error tracking** with stack traces in development
4. **Performance metrics** via Cloud Monitoring

## Development

### Project Structure

```
src/
├── index.ts              # Main server entry point
├── middleware/           # Express middleware
│   ├── auth.middleware.ts
│   └── error.middleware.ts
├── routes/              # API routes
│   ├── upload.routes.ts
│   ├── metadata.routes.ts
│   └── health.routes.ts
├── services/            # Business logic
│   ├── firestore.service.ts
│   ├── storage.service.ts
│   └── permission.service.ts
├── types/               # TypeScript types
│   └── index.ts
└── utils/               # Utility functions
    ├── ApiError.ts
    └── asyncHandler.ts
```

### Adding New Features

1. Define types in `src/types/`
2. Create service in `src/services/`
3. Add routes in `src/routes/`
4. Register routes in `src/index.ts`

## License

MIT

## Support

For issues and feature requests, please create an issue in the repository.