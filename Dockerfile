FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY server.js ./server.js
COPY src ./src
COPY public ./public

EXPOSE 3000

CMD ["node", "server.js"]
