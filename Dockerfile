# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --legacy-peer-deps: @nestjs/schematics@12 (a dev-only codegen tool we never
# run — `nest generate`) declares a `typescript >=6.0.0` peer that no 12.x
# release relaxes; we stay on TypeScript 5.9 rather than take that upgrade
# as a side effect of the Nest 12 migration. Harmless to skip: nothing here
# touches schematics at build or run time.
RUN npm ci --legacy-peer-deps
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# Apply pending migrations, then start. Running migrations on start is fine
# for a single instance; with several replicas, run them as a separate
# release step instead.
CMD ["sh", "-c", "npm run migration:run:prod && node dist/main"]
