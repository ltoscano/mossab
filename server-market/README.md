# 🏪 Mossab Marketplace Server

Central community repository for sharing and discovering Mossab agents and workflows.

## 🚀 Quick Start

### 1. Installation

```bash
cd server-market
npm install
```

### 2. Configuration

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Initialize Database

```bash
npm run init-db
```

This creates:
- SQLite database
- Admin user
- Sample items

**SAVE THE API KEY** displayed after initialization!

### 4. Start Server

```bash
npm start
```

Server runs on `http://localhost:4000`

## 📡 API Endpoints

### Public Endpoints (No Auth Required)

#### Browse Items
```bash
GET /api/items?type=agent&category=development&search=code&sortBy=downloads&limit=20&offset=0
```

Response:
```json
{
  "success": true,
  "items": [...],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Get Item Details
```bash
GET /api/items/:id
```

#### Download Item
```bash
POST /api/items/:id/download
```

#### Marketplace Stats
```bash
GET /api/stats
```

### User Endpoints

#### Register
```bash
POST /api/users/register
Content-Type: application/json

{
  "username": "myusername",
  "email": "me@example.com",
  "password": "securepassword123"
}
```

Response includes your **API key** - save it!

#### Login
```bash
POST /api/users/login
Content-Type: application/json

{
  "username": "myusername",
  "password": "securepassword123"
}
```

Returns your API key.

### Authenticated Endpoints (Require API Key)

**Include header:**
```
X-API-Key: your-api-key-here
```
or
```
Authorization: Bearer your-api-key-here
```

#### Publish Item
```bash
POST /api/items
X-API-Key: your-api-key
Content-Type: application/json

{
  "type": "agent",
  "name": "my-agent",
  "version": "1.0.0",
  "title": "My Amazing Agent",
  "description": "Does amazing things",
  "content": {
    "model": "claude-sonnet-4-5",
    "tools": ["web_search"],
    "system_prompt": "You are..."
  },
  "category": "development",
  "tags": ["coding", "ai"]
}
```

#### Rate Item
```bash
POST /api/items/:id/rate
X-API-Key: your-api-key
Content-Type: application/json

{
  "rating": 5,
  "review": "Excellent agent!"
}
```

#### Get My Profile
```bash
GET /api/users/me
X-API-Key: your-api-key
```

#### Get My Published Items
```bash
GET /api/users/me/items
X-API-Key: your-api-key
```

#### Update Item
```bash
PUT /api/items/:id
X-API-Key: your-api-key
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description",
  "tags": ["new", "tags"]
}
```

#### Delete Item
```bash
DELETE /api/items/:id
X-API-Key: your-api-key
```

## 🗄️ Database Schema

### SQLite (Default)
- Location: `./data/marketplace.db`
- Tables: users, items, ratings, downloads
- Automatic migrations

### PostgreSQL (Future)
Uncomment `DATABASE_URL` in `.env` for PostgreSQL support.

## 🔒 Security

- Passwords: bcrypt hashed
- API Keys: Cryptographically secure
- Rate limiting: TODO
- CORS: Enabled for all origins (configure for production)

## 📦 Deployment

### Option 1: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
```

```bash
docker build -t mossab-marketplace .
docker run -p 4000:4000 -v $(pwd)/data:/app/data mossab-marketplace
```

### Option 2: Railway/Render/Heroku

1. Push to GitHub
2. Connect repository
3. Set environment variables
4. Deploy!

### Option 3: VPS (Linux)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <your-repo>
cd server-market
npm install
npm run init-db

# Run with PM2
sudo npm install -g pm2
pm2 start index.js --name mossab-marketplace
pm2 save
pm2 startup
```

## 🧪 Testing

### Manual Testing

```bash
# Register user
curl -X POST http://localhost:4000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"password123"}'

# Get API key from response

# Publish agent
curl -X POST http://localhost:4000/api/items \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "type": "agent",
    "name": "test-agent",
    "version": "1.0.0",
    "title": "Test Agent",
    "description": "For testing",
    "content": {"model": "claude-sonnet-4-5"}
  }'

# Browse items
curl http://localhost:4000/api/items
```

## 🔧 Configuration

### Environment Variables

- `PORT` / `MARKETPLACE_PORT`: Server port (default: 4000)
- `DB_PATH`: SQLite database path
- `ADMIN_USERNAME`: Initial admin username
- `ADMIN_EMAIL`: Initial admin email
- `ADMIN_PASSWORD`: Initial admin password (change after first login!)
- `NODE_ENV`: production/development

### Production Recommendations

1. **Change admin password** immediately
2. **Use HTTPS** (reverse proxy with Nginx/Caddy)
3. **Add rate limiting** (express-rate-limit)
4. **Configure CORS** for specific origins
5. **Backup database** regularly
6. **Monitor logs** (PM2, CloudWatch, etc.)
7. **Migrate to PostgreSQL** for high traffic

## 📊 Monitoring

### Database Stats

```bash
curl http://localhost:4000/api/stats
```

### Health Check

```bash
curl http://localhost:4000/health
```

### Logs

```bash
# If using PM2
pm2 logs mossab-marketplace

# Docker
docker logs <container-id>
```

## 🆘 Troubleshooting

### Database locked
SQLite can lock with concurrent writes. Solution: Use PostgreSQL for production.

### Permission denied
```bash
chmod +x scripts/init-db.js
chmod 755 data/
```

### Port already in use
```bash
# Change PORT in .env
PORT=5000 npm start
```

## 📝 License

MIT

---

**Made with ❤️ by Mossab Community**
