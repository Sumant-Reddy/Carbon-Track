#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Starting CarbonTrack Backend Setup...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js v18 or higher.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
if [ $(echo "$NODE_VERSION < 18.0.0" | bc) -eq 1 ]; then
    echo -e "${RED}Node.js version must be 18 or higher. Current version: $NODE_VERSION${NC}"
    exit 1
fi

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo -e "${YELLOW}MongoDB is not installed. Please install MongoDB.${NC}"
    echo -e "${YELLOW}You can download it from: https://www.mongodb.com/try/download/community${NC}"
    exit 1
fi

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo -e "${YELLOW}Redis is not installed. Please install Redis.${NC}"
    echo -e "${YELLOW}You can download it from: https://redis.io/download${NC}"
    exit 1
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}Please update the .env file with your configuration values.${NC}"
    exit 1
fi

# Start MongoDB
echo -e "${YELLOW}Starting MongoDB...${NC}"
mongod --dbpath ./data/db &

# Start Redis
echo -e "${YELLOW}Starting Redis...${NC}"
redis-server &

# Wait for services to start
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 5

# Start the application
echo -e "${GREEN}Starting the application...${NC}"
npm run dev 