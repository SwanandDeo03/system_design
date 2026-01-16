FROM node:20-alpine

# Set environment
ENV NODE_ENV=production

# Create app directory
WORKDIR /usr/src/app

# Install dependencies first (better cache)
COPY package.json package-lock.json ./
RUN npm install --production

# Copy application source
COPY . .

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
