FROM node:20-alpine
WORKDIR /app

# Monorepo manifests for dependency install
COPY package.json ./
COPY apps/api/package.json apps/api/
RUN npm install

# Sources (overridden by the compose bind-mount in dev)
COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

WORKDIR /app/apps/api
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
