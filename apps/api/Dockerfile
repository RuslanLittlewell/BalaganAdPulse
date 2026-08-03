FROM node:24-alpine
WORKDIR /app

# Monorepo manifests for dependency install
COPY package.json ./
COPY apps/api/package.json apps/api/
RUN npm install

# Sources (overridden by the compose bind-mount in dev)
COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

WORKDIR /app/apps/api
# `prisma generate` runs again at startup: node_modules lives in an anonymous volume
# that Compose carries over between recreations, so the baked-in client can be stale.
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm run dev"]
