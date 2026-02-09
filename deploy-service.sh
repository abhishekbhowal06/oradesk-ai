#!/bin/bash

# Dentacore AI Calling Service - Deployment Script
# Usage: ./deploy.sh [PROJECT_ID]

PROJECT_ID=$1
SERVICE_NAME="dentacore-ai-calling"
REGION="us-central1"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: ./deploy.sh [PROJECT_ID]"
  exit 1
fi

echo "Deploying $SERVICE_NAME to $PROJECT_ID in $REGION..."

# 1. Build and Push Container
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME ./services/ai-calling

# 2. Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest,TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest,TWILIO_PHONE_NUMBER=TWILIO_PHONE_NUMBER:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-env-vars="SERVICE_URL=https://$SERVICE_NAME-$PROJECT_ID.a.run.app"

echo "Deployment complete."
