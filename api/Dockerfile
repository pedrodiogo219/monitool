###################################
# Builder stage
###################################

# Switch to a clean image
FROM node:10 as builder
WORKDIR /app

# Install prod + dev dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Build source code
COPY lib ./lib
RUN yarn run build

###################################
# Production stage
###################################

# Switch to a clean image
FROM node:10-slim as production
WORKDIR /app

# Install prod dependencies only
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

# Retrieve pre-built source code from previous stage
COPY --from=builder /app/dist ./dist

# Run monitool API
EXPOSE 80
CMD node ./dist/main-webapp.js
