# ── Stage 1: build ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
# Lockfile na hone ke kaaran humne yahan install use kiya hai
RUN npm install

COPY . .

# Pass API URL at build time; Render build environments will inject this
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


# ── Stage 2: serve with Nginx ──────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# SPA-friendly nginx config set to port 10000 for Render
COPY --from=builder /app/dist /usr/share/nginx/html

RUN printf 'server {\n\
    listen 10000;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Serve static assets with long cache\n\
    location /assets/ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
\n\
    # All other routes -> SPA\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    gzip on;\n\
    gzip_types text/plain text/css application/javascript application/json;\n\
}\n' > /etc/nginx/conf.d/app.conf

EXPOSE 10000

CMD ["nginx", "-g", "daemon off;"]
