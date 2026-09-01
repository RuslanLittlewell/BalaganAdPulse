FROM node:26-slim
# node:*-slim ships libssl but not the openssl CLI, which Prisma's engine
# version detection shells out to.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Monorepo manifests for dependency install
COPY package.json ./
COPY apps/api/package.json apps/api/
COPY packages/access-policy/package.json packages/access-policy/
COPY scripts/patch-avataaars-react.cjs scripts/
RUN npm install

# Sources (overridden by the compose bind-mount in dev)
COPY . .
# The shared permission matrix ships as built JS, and .dockerignore keeps
# every dist/ out of the build context, so the image builds its own.
RUN npm run build -w @adpulse/access-policy
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

WORKDIR /app/apps/api
# `prisma generate` runs again at startup: node_modules lives in an anonymous volume
# that Compose carries over between recreations, so the baked-in client can be stale.
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm run dev"]
