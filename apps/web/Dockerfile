FROM node:24-alpine
WORKDIR /app

# Monorepo manifests for dependency install
COPY package.json ./
COPY apps/web/package.json apps/web/
RUN npm install

# Sources (overridden by the compose bind-mount in dev)
COPY . .

WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
