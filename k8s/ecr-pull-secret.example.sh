#!/usr/bin/env bash

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REGISTRY="${ECR_REGISTRY:-123456789012.dkr.ecr.us-east-1.amazonaws.com}"
NAMESPACE="${NAMESPACE:-prd}"
SECRET_NAME="${SECRET_NAME:-ecr-pull-secret}"

if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
  echo "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required."
  echo "Load them from a local env file or export them before running this script."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to obtain the ECR login password with amazon/aws-cli."
  exit 1
fi

ECR_PASSWORD="$(
  docker run --rm \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    -e AWS_REGION \
    amazon/aws-cli:2.17.32 \
    ecr get-login-password --region "$AWS_REGION"
)"

kubectl -n "$NAMESPACE" create secret docker-registry "$SECRET_NAME" \
  --docker-server="$ECR_REGISTRY" \
  --docker-username=AWS \
  --docker-password="$ECR_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -
