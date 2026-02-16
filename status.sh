#!/bin/bash
# D.A.K - Check status of all services

echo "=========================================="
echo "  D.A.K - Service Status"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Docker services
echo "🐳 Docker Services:"
docker ps --filter "name=dak" --format "  {{.Names}}: {{.Status}}" 2>/dev/null || echo "  No Docker services running"
echo ""

# Local services
echo "🖥️  Local Services:"
if [ -f /tmp/dak-api.pid ] && kill -0 $(cat /tmp/dak-api.pid) 2>/dev/null; then
    echo -e "  API:             ${GREEN}✓${NC} Running (PID: $(cat /tmp/dak-api.pid)) - http://localhost:3000"
else
    echo -e "  API:             ${RED}✗${NC} Not running"
fi

if [ -f /tmp/dak-institute.pid ] && kill -0 $(cat /tmp/dak-institute.pid) 2>/dev/null; then
    echo -e "  Community Admin: ${GREEN}✓${NC} Running (PID: $(cat /tmp/dak-institute.pid)) - http://localhost:5175"
else
    echo -e "  Community Admin: ${RED}✗${NC} Not running"
fi

if [ -f /tmp/dak-user.pid ] && kill -0 $(cat /tmp/dak-user.pid) 2>/dev/null; then
    echo -e "  Devotee Portal:  ${GREEN}✓${NC} Running (PID: $(cat /tmp/dak-user.pid)) - http://localhost:5176"
else
    echo -e "  Devotee Portal:  ${RED}✗${NC} Not running"
fi
echo ""

# ngrok
echo "🌐 ngrok Tunnels:"
if pgrep -x "ngrok" > /dev/null; then
    echo -e "  Status: ${GREEN}✓${NC} Running"
    echo "  Dashboard: http://localhost:4040"
    echo ""
    echo "  Public URLs:"
    curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"name":"[^"]*",".*"public_url":"[^"]*"' | while read line; do
        NAME=$(echo "$line" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        URL=$(echo "$line" | grep -o '"public_url":"[^"]*"' | cut -d'"' -f4)
        printf "    %-12s %s\n" "$NAME:" "$URL"
    done
else
    echo -e "  Status: ${RED}✗${NC} Not running"
fi
echo ""

echo "=========================================="
echo "📝 View logs:"
echo "   tail -f /tmp/dak-api.log"
echo "   tail -f /tmp/dak-institute.log"
echo "   tail -f /tmp/dak-user.log"
echo "=========================================="
echo ""
