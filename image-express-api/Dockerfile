# Backend: Node.js + TypeScript (multi-stage)
FROM node:22-alpine AS deps
WORKDIR /home/node/app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine AS build
WORKDIR /home/node/app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /home/node/app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

RUN mkdir -p /home/node/app/storage/images/input \
             /home/node/app/output \
             /home/node/app/logs \
             /home/node/app/temp && \
    chown -R nodeuser:nodejs /home/node/app && \
    chmod -R 755 /home/node/app

COPY --from=deps /home/node/app/node_modules ./node_modules
COPY --from=build /home/node/app/dist ./dist
COPY swagger.yaml ./

ENV STORAGE_INPUT_PATH=/home/node/app/storage/images/input \
    STORAGE_OUTPUT_PATH=/home/node/app/output

USER nodeuser
EXPOSE 3000
CMD ["node", "dist/main.js"]