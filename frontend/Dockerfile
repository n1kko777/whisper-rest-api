# Dockerfile for Next.js frontend
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile

# Build the Next.js application
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

# Run the Next.js application
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
# Next.js 13+ requires the .next directory to be copied
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
