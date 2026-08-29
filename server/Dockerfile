FROM node:22-slim
WORKDIR /app
# better-sqlite3 compiles a native addon when no prebuilt binary is available
# for this platform; node:22-slim ships without a toolchain, so add one.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY relay.js store.js ./
EXPOSE 8787
CMD ["node", "relay.js"]
