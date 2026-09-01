FROM node:26-slim
WORKDIR /app

# Monorepo manifests for dependency install
COPY package.json ./
COPY apps/web/package.json apps/web/
COPY packages/access-policy/package.json packages/access-policy/
COPY scripts/patch-avataaars-react.cjs scripts/
RUN npm install --legacy-peer-deps

# Sources (overridden by the compose bind-mount in dev)
COPY . .
# See apps/api/Dockerfile: dist/ never reaches the build context.
RUN npm run build -w @adpulse/access-policy

WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
