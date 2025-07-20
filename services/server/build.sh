#!/bin/bash

# Build script for multi-platform Docker images
# This script handles building for different architectures

set -e

# Default values
IMAGE_NAME="fastify-server"
TAG="latest"
PLATFORM="linux/amd64"  # Target x86_64 for production

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    --image-name)
      IMAGE_NAME="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --platform PLATFORM    Target platform (default: linux/amd64)"
      echo "  --tag TAG              Image tag (default: latest)"
      echo "  --image-name NAME      Image name (default: fastify-server)"
      echo "  --help                 Show this help message"
      echo ""
      echo "Platform options:"
      echo "  linux/amd64            x86_64 architecture (production)"
      echo "  linux/arm64            ARM64 architecture (M1/M2 Macs)"
      echo "  linux/arm/v7           ARM v7 architecture"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo "Building Docker image: $IMAGE_NAME:$TAG"
echo "Target platform: $PLATFORM"

# Build the Docker image with the specified platform
docker buildx build \
  --platform $PLATFORM \
  --tag $IMAGE_NAME:$TAG \
  --load \
  .

echo "Build completed successfully!"
echo "To run the container:"
echo "  docker run -p 3000:3000 $IMAGE_NAME:$TAG" 