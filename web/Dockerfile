FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production

CMD ["sh", "-c", "npm run start -- --port ${PORT:-3000}"]
