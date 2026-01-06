#!/bin/bash
set -e

echo "Cleaning up test data..."

# Stop and remove test stack
docker-compose -f docker/docker-compose.yml down -v

# Remove test databases
rm -rf tmp/test-data

echo "Test cleanup complete!"
