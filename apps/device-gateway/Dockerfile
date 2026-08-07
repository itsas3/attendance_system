FROM node:24-alpine

WORKDIR /app
RUN npm install -g corepack@latest && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/device-gateway/package.json apps/device-gateway/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/db/prisma packages/db/prisma
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @attendance/db generate
RUN pnpm --filter @attendance/device-gateway build
RUN chown -R node:node /app

ENV NODE_ENV=production
USER node
EXPOSE 4001
CMD ["pnpm", "--filter", "@attendance/device-gateway", "start"]
