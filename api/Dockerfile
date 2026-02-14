FROM node:20-alpine

WORKDIR /app

# Using bcryptjs (pure JS) - no native build tools needed

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# SMTP configuration for email (cancellation notifications etc.)
ENV SMTP_HOST=""
ENV SMTP_PORT=587
ENV SMTP_SECURE=false
ENV SMTP_USER=""
ENV SMTP_PASS=""
ENV SMTP_FROM="D.A.K <noreply@dak.com>"

EXPOSE 3000

CMD ["node", "src/index.js"]
