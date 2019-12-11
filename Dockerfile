FROM node:lts-alpine as BUILDER
WORKDIR /app

RUN apk add --no-cache git
COPY package* /app/
RUN npm ci

COPY . /app
RUN npm run build

FROM node:lts-alpine
WORKDIR /app

RUN apk add --no-cache git
COPY package* /app/
COPY --from=BUILDER /app/dist/ /app
COPY public/ /app/public
RUN npm ci --only=prod

CMD ["node", "src/server.js"]
