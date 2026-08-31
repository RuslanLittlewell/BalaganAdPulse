FROM node:26-slim
WORKDIR /app

# Monorepo manifests for dependency install
COPY package.json ./
COPY apps/web/package.json apps/web/
COPY scripts/patch-avataaars-react.cjs scripts/
RUN npm install --legacy-peer-deps

# Sources (overridden by the compose bind-mount in dev)
COPY . .

WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
