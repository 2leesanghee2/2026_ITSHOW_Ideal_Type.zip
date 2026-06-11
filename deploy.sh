#!/bin/bash
# 이상형.zip 배포 스크립트
# 사용법: bash deploy.sh

KEY="/c/Users/sangh/Downloads/3210_keypair.pem"
SERVER="ubuntu@54.180.82.167"
REMOTE_DIR="/var/www/ideal-type-zip"

echo "🔨 빌드 중..."
npm run build || { echo "❌ 빌드 실패"; exit 1; }

echo "📦 서버에 업로드 중..."
scp -i "$KEY" -o StrictHostKeyChecking=no -r dist/* "$SERVER:$REMOTE_DIR/"

echo "✅ 배포 완료! → https://ideal-type-zip.mirim-it-show.site"
