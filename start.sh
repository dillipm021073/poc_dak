#!/bin/bash
# D.A.K - Start all services with ngrok
# Run external services locally, internal services in Docker

set -e

PROJECT_DIR="/mnt/c/Projects/DAK"
cd "$PROJECT_DIR"

echo "=========================================="
echo "  D.A.K - Starting All Services"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Start Docker services (DB + Platform Admin only)
echo -e "${BLUE}[1/5]${NC} Starting Docker services (Database + Platform Admin)..."
docker-compose up -d db admin
docker-compose stop api institute user 2>/dev/null || true
echo -e "${GREEN}✓${NC} Docker services started"
echo ""

# Step 2: Wait for DB to be ready
echo -e "${BLUE}[2/5]${NC} Waiting for database to be ready..."
sleep 5
until docker exec dak-db-1 pg_isready -U dak > /dev/null 2>&1; do
    echo "  Waiting for database..."
    sleep 2
done
echo -e "${GREEN}✓${NC} Database ready"
echo ""

# Step 3: Install npm dependencies if needed
echo -e "${BLUE}[3/5]${NC} Checking npm dependencies..."
for dir in api institute user; do
    if [ ! -d "$PROJECT_DIR/$dir/node_modules" ]; then
        echo "  Installing $dir dependencies..."
        cd "$PROJECT_DIR/$dir"
        npm install > /dev/null 2>&1
        echo -e "  ${GREEN}✓${NC} $dir dependencies installed"
    fi
done
cd "$PROJECT_DIR"
echo -e "${GREEN}✓${NC} All dependencies ready"
echo ""

# Step 4: Start local services (API + external frontends)
echo -e "${BLUE}[4/5]${NC} Starting local services..."

# Kill any existing processes
pkill -f "node.*api" 2>/dev/null || true
pkill -f "vite.*517" 2>/dev/null || true
sleep 2

# Start API locally
cd "$PROJECT_DIR/api"
DATABASE_URL="postgres://dak:dak_password@localhost:5432/dak" \
JWT_SECRET="dak-mvp-v3-secret-key" \
PORT=3000 \
node src/index.js > /tmp/dak-api.log 2>&1 &
API_PID=$!
echo "$API_PID" > /tmp/dak-api.pid

# Wait for API to start
sleep 3
until curl -s http://localhost:3000/health > /dev/null 2>&1; do
    echo "  Waiting for API..."
    sleep 2
done

# Start Institute Portal (Community Admin)
cd "$PROJECT_DIR/institute"
VITE_API_URL="http://localhost:3000/api" npm run dev -- --port 5175 --host > /tmp/dak-institute.log 2>&1 &
INSTITUTE_PID=$!
echo "$INSTITUTE_PID" > /tmp/dak-institute.pid

# Start User Portal (Devotee)
cd "$PROJECT_DIR/user"
VITE_API_URL="http://localhost:3000/api" npm run dev -- --port 5176 --host > /tmp/dak-user.log 2>&1 &
USER_PID=$!
echo "$USER_PID" > /tmp/dak-user.pid

cd "$PROJECT_DIR"
sleep 8
echo -e "${GREEN}✓${NC} Local services started"
echo "  API:             http://localhost:3000 (PID: $API_PID)"
echo "  Community Admin: http://localhost:5175 (PID: $INSTITUTE_PID)"
echo "  Devotee Portal:  http://localhost:5176 (PID: $USER_PID)"
echo ""

# Step 5: Start ngrok tunnels
echo -e "${BLUE}[5/5]${NC} Starting ngrok tunnels..."

# Kill any existing ngrok processes
pkill -f "ngrok" 2>/dev/null || true
sleep 2

# Create ngrok config
cat > "$PROJECT_DIR/.ngrok.yml" <<EOF
version: "2"
authtoken: 2uI7asOcpQtEzhdJRiK1VGjDVPQ_6LQoLtctgFoAWvE7kWEEy

tunnels:
  api:
    proto: http
    addr: 3000
    inspect: true

  institute:
    proto: http
    addr: 5175
    inspect: true

  user:
    proto: http
    addr: 5176
    inspect: true
EOF

# Start ngrok
nohup ngrok start --all --config "$PROJECT_DIR/.ngrok.yml" > "$PROJECT_DIR/.ngrok.log" 2>&1 &
sleep 6
echo -e "${GREEN}✓${NC} ngrok tunnels started"
echo ""

# Get public URLs
echo -e "${BLUE}Gathering public URLs...${NC}"
sleep 2

API_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"name":"api".*"public_url":"https://[^"]*"' | grep -o 'https://[^"]*' | head -1)
INSTITUTE_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"name":"institute".*"public_url":"https://[^"]*"' | grep -o 'https://[^"]*' | head -1)
USER_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"name":"user".*"public_url":"https://[^"]*"' | grep -o 'https://[^"]*' | head -1)

if [ -z "$API_URL" ]; then
    echo -e "${RED}✗${NC} Failed to get ngrok URLs"
    echo "Check ngrok log: $PROJECT_DIR/.ngrok.log"
    exit 1
fi

echo -e "${GREEN}✓${NC} Public URLs retrieved"
echo ""

# Restart external frontends with ngrok API URL
echo -e "${BLUE}Reconfiguring frontends with public API...${NC}"

# Kill existing frontend processes (including child Vite processes)
kill $INSTITUTE_PID $USER_PID 2>/dev/null || true
pkill -f "vite.*--port 5175" 2>/dev/null || true
pkill -f "vite.*--port 5176" 2>/dev/null || true
sleep 3

# Restart with ngrok API URL
cd "$PROJECT_DIR/institute"
VITE_API_URL="${API_URL}/api" npm run dev -- --port 5175 --host > /tmp/dak-institute.log 2>&1 &
INSTITUTE_PID=$!
echo "$INSTITUTE_PID" > /tmp/dak-institute.pid

cd "$PROJECT_DIR/user"
VITE_API_URL="${API_URL}/api" npm run dev -- --port 5176 --host > /tmp/dak-user.log 2>&1 &
USER_PID=$!
echo "$USER_PID" > /tmp/dak-user.pid

cd "$PROJECT_DIR"
sleep 5
echo -e "${GREEN}✓${NC} All services configured"
echo ""

# Display summary
echo ""
echo "=========================================="
echo "  🚀 D.A.K - All Services Running!"
echo "=========================================="
echo ""

echo -e "${GREEN}Backend API:${NC}"
echo "  Local:  http://localhost:3000"
echo "  Public: $API_URL"
echo ""

echo -e "${GREEN}Platform Admin Portal:${NC}"
echo "  Local:  http://localhost:3001 (Docker)"
echo "  Public: ${YELLOW}Not exposed (internal only)${NC}"
echo ""

echo -e "${GREEN}Community Admin Portal (Institute):${NC}"
echo "  Local:  http://localhost:5175"
echo "  Public: $INSTITUTE_URL"
echo ""

echo -e "${GREEN}Devotee Portal (User):${NC}"
echo "  Local:  http://localhost:5176"
echo "  Public: $USER_URL"
echo ""

echo "=========================================="
echo -e "${YELLOW}Resources:${NC}"
echo "  📊 ngrok Dashboard: http://localhost:4040"
echo "  📝 API Log: tail -f /tmp/dak-api.log"
echo "  📝 Frontend Logs: tail -f /tmp/dak-*.log"
echo "  🛑 Stop: ./stop.sh"
echo "=========================================="
echo ""

echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}Access from mobile:${NC}"
echo "  Community Admin: $INSTITUTE_URL"
echo "  Devotee Portal:  $USER_URL"
echo ""
