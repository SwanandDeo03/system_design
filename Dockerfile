FROM node:20-alpine

# Set environment
ENV NODE_ENV=production

# Create app directory
WORKDIR /usr/src/app

# Copy dependency files first (better caching)
COPY package.json package-lock.json ./

# Install ONLY production dependencies (Node 20 safe)
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Expose app port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
