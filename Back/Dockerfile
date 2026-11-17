# Imagen del servidor AquaControl: compila el Front (React/Vite) y el Back
# (Express/TypeScript) y sirve los dos desde Express en el puerto 3000.
# Se construye desde la raíz del repo:  docker build -f Back/Dockerfile .

# --- 1) Build del Front ---------------------------------------------------
FROM node:22-slim AS front
WORKDIR /app/Front
COPY Front/package.json Front/package-lock.json ./
RUN npm ci
COPY Front/ ./
RUN npm run build

# --- 2) Build del Back ----------------------------------------------------
FROM node:22-slim AS back
WORKDIR /app/Back
COPY Back/package.json Back/package-lock.json ./
RUN npm ci
COPY Back/tsconfig.json ./
COPY Back/src ./src
RUN npx tsc

# --- 3) Imagen final: solo dependencias de producción + JS compilado -------
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY Back/package.json Back/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=back /app/Back/dist ./dist
COPY --from=front /app/Front/dist ./public
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
