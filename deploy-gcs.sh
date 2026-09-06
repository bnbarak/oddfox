#!/usr/bin/env bash
# Fallback: plain Cloud Storage static website (HTTP only on the bucket URL;
# a custom domain over HTTPS needs an external HTTPS load balancer, ~$18/mo).
# Firebase Hosting is cheaper and includes TLS — see README.
set -euo pipefail

BUCKET="${1:?usage: ./deploy-gcs.sh gs://your-bucket-name}"

gsutil -m rsync -d -r -x '^(\.git|\.claude|tools|media-src|firebase\.json|deploy-gcs\.sh|README\.md).*' . "$BUCKET"
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" "$BUCKET/assets/**"
gsutil -m setmeta -h "Cache-Control:public, max-age=0, must-revalidate" "$BUCKET/index.html"
gsutil web set -m index.html -e index.html "$BUCKET"

echo "Deployed to $BUCKET"
