# --- Backend ---
FROM python:3.12-slim AS backend
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]

# --- Frontend build ---
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY skydash/frontend/package.json skydash/frontend/package-lock.json* ./
RUN npm install
COPY skydash/frontend/ .
ARG VITE_API_URL=http://localhost:8001
ARG VITE_WS_URL=ws://localhost:8001
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
RUN npm run build

# --- Frontend serve ---
FROM nginx:alpine AS frontend
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
