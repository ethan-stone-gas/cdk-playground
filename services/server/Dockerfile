# Use Amazon Linux 2023 as base image
FROM public.ecr.aws/amazonlinux/amazonlinux:2023 AS base

RUN yum update -y
RUN curl -sL https://rpm.nodesource.com/setup_22.x | bash -
RUN yum install -y nodejs

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml* ./

# Build stage - install all dependencies including dev dependencies
FROM base AS build

# Install all dependencies (including dev dependencies)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the TypeScript application
RUN pnpm run build

# Production stage - only install production dependencies
FROM base AS production

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Start the application using pnpm
CMD ["pnpm", "start"]
