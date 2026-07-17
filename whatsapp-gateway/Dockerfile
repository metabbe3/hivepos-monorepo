FROM node:20-slim

# Baileys needs these native build tools.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY src/ ./src/

RUN mkdir -p auth-states
VOLUME ["/app/auth-states"]

EXPOSE 3001

CMD ["node", "src/index.js"]
