FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm install --workspace apps/web --include-workspace-root && mkdir -p apps/web/node_modules

FROM node:20-alpine AS build
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json tsconfig.base.json ./
COPY apps/web ./apps/web
RUN npm run build -w apps/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.ts ./apps/web/next.config.ts

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "start"]
