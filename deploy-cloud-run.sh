#!/usr/bin/env bash
set -euo pipefail
: "${PROJECT_ID:?Defini PROJECT_ID}"
: "${MONGODB_URI:?Defini MONGODB_URI}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-notas-fullstack}"
SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
gcloud config set project "$PROJECT_ID"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 512Mi \
  --set-env-vars "MONGODB_URI=${MONGODB_URI},MONGODB_DB=notas,JWT_SECRET=${SECRET}"
gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)'
