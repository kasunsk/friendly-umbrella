# Deployment Guide

Guide for deploying the Construction Pricing Platform to production.

## Prerequisites

- Production server (Linux recommended)
- Docker and Docker Compose installed
- Domain name configured
- SSL certificate
- Database backup strategy

## Deployment Options

### Option 1: Docker Compose (Recommended)

#### 1. Prepare Production Environment

Create `docker-compose.prod.yml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: construction_pricing
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/construction_pricing
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

#### 2. Build and Deploy

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npm run db:migrate:deploy
```

### Option 2: Manual Deployment

#### 1. Server Setup

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install postgresql-15

# Install Redis
sudo apt-get install redis-server

# Install PM2
sudo npm install -g pm2
```

#### 2. Application Setup

```bash
# Clone repository
git clone https://github.com/your-repo/friendly-umbrella.git
cd friendly-umbrella

# Install dependencies
npm install

# Build applications
npm run build
```

#### 3. Database Setup

```bash
# Create database
sudo -u postgres createdb construction_pricing

# Run migrations
cd packages/backend
npm run db:migrate:deploy
```

#### 4. Start Services

```bash
# Start backend with PM2
cd packages/backend
pm2 start dist/index.js --name backend

# Start frontend with PM2
cd packages/frontend
pm2 start npm --name frontend -- start
```

## Nginx Configuration

### Reverse Proxy Setup

Create `/etc/nginx/sites-available/construction-pricing`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/construction-pricing /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Environment Variables

### Production .env

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/construction_pricing?schema=public"

# JWT (Use strong, random secrets)
JWT_SECRET="<generate-strong-secret>"
JWT_REFRESH_SECRET="<generate-strong-secret>"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=8000
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com

# Redis
REDIS_URL="redis://localhost:6379"

# Logging
LOG_LEVEL=info
```

## Security Checklist

- [ ] Use strong JWT secrets
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Set up firewall rules
- [ ] Enable database backups
- [ ] Use environment variables for secrets
- [ ] Keep dependencies updated
- [ ] Enable rate limiting
- [ ] Set up monitoring
- [ ] Configure log rotation

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:8000/health

# Database connection
psql -U user -d construction_pricing -c "SELECT 1"

# Redis connection
redis-cli ping
```

### Logs

```bash
# Backend logs
pm2 logs backend

# Frontend logs
pm2 logs frontend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Backup Strategy

### Database Backup

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump construction_pricing > /backups/db_$DATE.sql
```

### Automated Backups

Add to crontab:
```bash
0 2 * * * /path/to/backup-script.sh
```

## Updates

### Deployment Process

1. Pull latest code:
   ```bash
   git pull origin main
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run migrations:
   ```bash
   cd packages/backend
   npm run db:migrate:deploy
   ```

4. Build applications:
   ```bash
   npm run build
   ```

5. Restart services:
   ```bash
   pm2 restart backend frontend
   ```

## Troubleshooting

### Service Won't Start

1. Check logs:
   ```bash
   pm2 logs
   ```

2. Verify environment variables
3. Check database connection
4. Verify ports are available

### Database Issues

1. Check PostgreSQL status:
   ```bash
   sudo systemctl status postgresql
   ```

2. Verify database exists
3. Check connection string
4. Review migration status

### Performance Issues

1. Monitor resource usage
2. Check database query performance
3. Review Redis cache usage
4. Optimize Nginx configuration












