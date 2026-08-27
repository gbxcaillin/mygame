FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY relay.js ./
EXPOSE 8787
CMD ["node", "relay.js"]
