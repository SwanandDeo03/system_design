FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy app source
COPY . .

# Default port and expose
ENV PORT=3001
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
