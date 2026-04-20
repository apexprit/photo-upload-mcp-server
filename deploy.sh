#!/bin/bash

# Google Cloud MCP Server Deployment Script
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-staging}
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="mcp-server"
IMAGE_NAME="gcr.io/$PROJECT_ID/mcp-server:latest"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Google Cloud MCP Server Deployment${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed. Please install Google Cloud SDK.${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    echo -e "${YELLOW}Warning: Not authenticated with gcloud. Running gcloud auth login...${NC}"
    gcloud auth login
fi

# Set project if PROJECT_ID is provided
if [ -n "$PROJECT_ID" ]; then
    echo -e "Setting project to: ${YELLOW}$PROJECT_ID${NC}"
    gcloud config set project $PROJECT_ID
else
    CURRENT_PROJECT=$(gcloud config get-value project)
    if [ -z "$CURRENT_PROJECT" ]; then
        echo -e "${RED}Error: No project configured. Please set PROJECT_ID in script or run:${NC}"
        echo -e "  gcloud config set project YOUR_PROJECT_ID"
        exit 1
    fi
    PROJECT_ID=$CURRENT_PROJECT
    echo -e "Using current project: ${YELLOW}$PROJECT_ID${NC}"
fi

# Enable required APIs
echo -e "\n${GREEN}Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com \
    firestore.googleapis.com \
    storage.googleapis.com \
    --project=$PROJECT_ID

# Build Docker image
echo -e "\n${GREEN}Building Docker image...${NC}"
docker build -t $IMAGE_NAME .

# Push to Container Registry
echo -e "\n${GREEN}Pushing image to Container Registry...${NC}"
docker push $IMAGE_NAME

# Deploy to Cloud Run
echo -e "\n${GREEN}Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 1 \
    --max-instances 10 \
    --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID" \
    --project=$PROJECT_ID

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region $REGION \
    --platform managed \
    --format="value(status.url)" \
    --project=$PROJECT_ID)

echo -e "\n${GREEN}✅ Deployment complete!${NC}"
echo -e "Service URL: ${YELLOW}$SERVICE_URL${NC}"
echo -e "Health check: ${YELLOW}$SERVICE_URL/health${NC}"
echo -e "\n${GREEN}Testing deployment...${NC}"

# Test health endpoint
if curl -s $SERVICE_URL/health | grep -q "healthy"; then
    echo -e "✅ Health check passed"
else
    echo -e "${RED}❌ Health check failed${NC}"
    exit 1
fi

echo -e "\n${GREEN}🎉 MCP Server is now running on Cloud Run!${NC}"
echo -e "Next steps:"
echo -e "1. Set up Firestore database: https://console.cloud.google.com/firestore"
echo -e "2. Create a Cloud Storage bucket: https://console.cloud.google.com/storage"
echo -e "3. Configure environment variables in Cloud Run console"
echo -e "4. Set up API keys and authentication"