FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci || npm install
RUN npx prisma generate
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
