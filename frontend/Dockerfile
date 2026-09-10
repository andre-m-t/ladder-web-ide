# syntax=docker/dockerfile:1

# Imagem de desenvolvimento do front-end. O dev server do Vite escuta em
# 0.0.0.0 (ver server.host em vite.config.ts).
FROM node:22-bookworm-slim

WORKDIR /app

# Camada de dependências separada para aproveitar o cache do Docker.
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
