#!/bin/bash

# PRODUCTION DEPLOYMENT SCRIPT
# Usage: ./deploy.sh

echo "🚀 Starting Deployment for Dentacor SaaS..."

# 1. Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# 2. Check for .env.production
if [ ! -f "services/ai-calling/.env.production" ]; then
    echo "❌ ERROR: services/ai-calling/.env.production not found!"
    echo "Please create it from .env.production.example"
    exit 1
fi

# 3. Create placeholder certs if they don't exist (to prevent Nginx crash on first run)
if [ ! -d "certbot/conf/live/dentacor.com" ]; then
    echo "⚠️  SSL Certs not found. Downloading recommended TLS parameters..."
    mkdir -p certbot/conf
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > certbot/conf/options-ssl-nginx.conf
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > certbot/conf/ssl-dhparams.pem
    
    echo "⚠️  Nginx will fail to start without certs. You must run the initial certbot command manually ONCE:"
    echo "    docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path /var/www/certbot -d dentacor.com -d app.dentacor.com -d api.dentacor.com"
fi

# 4. Build and Deploy
echo "🐳 Building and Deploying containers..."
docker compose -f docker-compose.prod.yml up -d --build

# 5. Cleanup
echo "🧹 Cleaning up unused images..."
docker image prune -f

echo "✅ Deployment Complete! Status:"
docker compose -f docker-compose.prod.yml ps
