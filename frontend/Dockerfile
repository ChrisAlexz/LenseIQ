FROM node:20-alpine

WORKDIR /app

# Copy package files first (better layer caching)
COPY package.json package-lock.json ./

RUN npm ci

# Copy the rest of the frontend code
COPY . .

# next.config.js's rewrites() resolves BACKEND_URL at build time (baked into
# the routes manifest) and only keeps the `backend` hostname as-is when
# NODE_ENV=production - otherwise it rewrites to `localhost`, which doesn't
# resolve to the backend container. `backend` is the stable docker-compose
# service hostname, so it's safe to bake in here.
ENV NODE_ENV=production
ENV BACKEND_URL=http://backend:8001

# Build the Next.js app
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
