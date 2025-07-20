# Fastify HTTP Server

A simple Fastify HTTP server written in TypeScript.

## Features

- Health check endpoint (`/health`)
- Root endpoint (`/`)
- Example API endpoint (`/api/hello`)
- TypeScript support
- Docker support with Amazon Linux 2
- Node.js 22.x support
- Multi-platform Docker builds

## Local Development

### Prerequisites

- Node.js 22.x or higher
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build and Run

```bash
npm run build
npm start
```

## Docker

### Prerequisites

- Docker with buildx support
- For M1/M2 Macs: Docker Desktop with buildx enabled

### Build the image

#### Using the build script (recommended)

```bash
# Build for x86_64 (production target)
./build.sh

# Build for ARM64 (M1/M2 Macs)
./build.sh --platform linux/arm64

# Build with custom tag
./build.sh --tag v1.0.0

# Build with custom image name
./build.sh --image-name my-server --tag latest
```

#### Manual build commands

```bash
# Build for x86_64 (production)
docker buildx build --platform linux/amd64 --tag fastify-server:latest --load .

# Build for ARM64 (M1/M2 Macs)
docker buildx build --platform linux/arm64 --tag fastify-server:latest --load .

# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 --tag fastify-server:latest --load .
```

### Run the container

```bash
docker run -p 3000:3000 fastify-server
```

### Run with custom port

```bash
docker run -p 8080:3000 -e PORT=3000 fastify-server
```

## Multi-Platform Builds

This project supports building Docker images for different CPU architectures:

- **linux/amd64** (x86_64): For production servers and traditional x86_64 environments
- **linux/arm64**: For ARM64 environments like M1/M2 Macs and ARM servers
- **linux/arm/v7**: For ARM v7 environments

### M1/M2 Mac Considerations

When building on an M1/M2 Mac:

1. **For production deployment**: Use `linux/amd64` platform to ensure compatibility with x86_64 servers
2. **For local development**: Use `linux/arm64` for faster builds and better performance
3. **For testing**: You can build for both platforms to ensure compatibility

Example:

```bash
# Build for production (x86_64)
./build.sh --platform linux/amd64

# Build for local development (ARM64)
./build.sh --platform linux/arm64
```

## API Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check
- `GET /api/hello` - Example API endpoint

## Environment Variables

- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `NODE_ENV` - Node environment (default: production in Docker)

## Node.js Version

This project uses Node.js 22.x for optimal performance and latest features.
