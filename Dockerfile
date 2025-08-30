# Dockerfile for backend container

FROM node:22-alpine as build
WORKDIR /app
COPY backend .
RUN npm ci --prodocution
# RUN npm build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server.js server.js

EXPOSE 3001
CMD [ "node", "server.js" ]
