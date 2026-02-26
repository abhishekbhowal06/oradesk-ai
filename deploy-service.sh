#!/bin/bash

# Dentacore AI Calling Service - Deployment Script
# Usage: ./deploy.sh [PROJECT_ID]

PROJECT_ID=$1
SERVICE_NAME="dentacore-ai-calling"
REGIONS=("us-central1" "us-east1" "europe-west1")

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: ./deploy.sh [PROJECT_ID]"
  exit 1
fi

echo "Building container for $SERVICE_NAME..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME ./services/ai-calling

for REGION in "${REGIONS[@]}"; do
  echo "--------------------------------------------------------"
  echo "Deploying to $REGION..."
  
  gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --concurrency 80 \
    --max-instances 50 \
    --min-instances 3 \
    --memory 2Gi \
    --set-secrets="SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest,TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest,TWILIO_PHONE_NUMBER=TWILIO_PHONE_NUMBER:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest" \
    --set-env-vars="SERVICE_URL=https://$SERVICE_NAME-$PROJECT_ID.a.run.app" \
    --no-traffic \
    --tag=green
done

echo "--------------------------------------------------------"
echo "✅ Deployment complete (GREEN revisions created in all regions)."
echo "Traffic is currently 100% on the old revisions (BLUE)."
echo "--------------------------------------------------------"
echo "To promote GREEN to 100% traffic across ALL regions:"
for REGION in "${REGIONS[@]}"; do
  echo "gcloud run services update-traffic $SERVICE_NAME --region $REGION --to-tags green=100"
done
echo "--------------------------------------------------------"
