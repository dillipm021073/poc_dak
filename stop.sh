#!/bin/bash
# D.A.K - Stop all services

PROJECT_DIR="/mnt/c/Projects/DAK"
cd "$PROJECT_DIR"

echo "=========================================="
echo "  D.A.K - Stopping All Services"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Stop local services
echo "[1/3] Stopping local services..."

if [ -f /tmp/dak-api.pid ]; then
    kill $(cat /tmp/dak-api.pid) 2>/dev/null && echo -e "  ${GREEN}✓${NC} API stopped" || echo "  - API not running"
    rm /tmp/dak-api.pid
fi

if [ -f /tmp/dak-institute.pid ]; then
    kill $(cat /tmp/dak-institute.pid) 2>/dev/null && echo -e "  ${GREEN}✓${NC} Community Admin stopped" || echo "  - Community Admin not running"
    rm /tmp/dak-institute.pid
fi

if [ -f /tmp/dak-user.pid ]; then
    kill $(cat /tmp/dak-user.pid) 2>/dev/null && echo -e "  ${GREEN}✓${NC} Devotee Portal stopped" || echo "  - Devotee Portal not running"
    rm /tmp/dak-user.pid
fi

# Fallback: kill any remaining processes
pkill -f "node.*api" 2>/dev/null
pkill -f "vite.*517" 2>/dev/null
echo ""

# Step 2: Stop ngrok
echo "[2/3] Stopping ngrok tunnels..."
pkill ngrok 2>/dev/null && echo -e "  ${GREEN}✓${NC} ngrok stopped" || echo "  - ngrok not running"
echo ""

# Step 3: Docker services
echo "[3/3] Docker services:"
echo -e "  ${YELLOW}Note:${NC} Database and Platform Admin are still running in Docker"
echo "  Run 'docker-compose down' to stop all Docker services"
docker ps --filter "name=dak" --format "  {{.Names}}: {{.Status}}" 2>/dev/null
echo ""

# Clean up log files
rm -f /tmp/dak-*.log "$PROJECT_DIR/.ngrok.log" 2>/dev/null

echo "=========================================="
echo -e "${GREEN}✓ All services stopped${NC}"
echo "=========================================="
echo ""
