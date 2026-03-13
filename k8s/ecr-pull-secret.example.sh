#!/usr/bin/env bash

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REGISTRY="${ECR_REGISTRY:-123456789012.dkr.ecr.us-east-1.amazonaws.com}"
NAMESPACE="${NAMESPACE:-prd}"
SECRET_NAME="${SECRET_NAME:-ecr-pull-secret}"

ECR_PASSWORD="$(aws ecr get-login-password --region "$AWS_REGION")"

kubectl -n "$NAMESPACE" create secret docker-registry "$SECRET_NAME" \
  --docker-server="$ECR_REGISTRY" \
  --docker-username=AWS \
  --docker-password="$ECR_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -
