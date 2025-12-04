# Setup & Installation Guide

Complete guide for setting up the Construction Pricing Platform development environment.

## Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **npm**: Version 10.0.0 or higher
- **PostgreSQL**: Version 15 or higher
- **Redis**: Version 7 or higher
- **Git**: Latest version

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-repo/friendly-umbrella.git
cd friendly-umbrella
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

#### Backend Environment

Copy the example environment file:
```bash
cp packages/backend/env.example packages/backend/.env
```

Edit `packages/backend/.env`:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/construction_pricing?schema=public"

# JWT
JWT_SECRET="your-secret-key-here"
JWT_REFRESH_SECRET="your-refresh-secret-key-here"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=8000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Redis
REDIS_URL="redis://localhost:6379"
```

#### Frontend Environment

Create `packages/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### 4. Setup Database

#### Using Docker (Recommended)

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis containers.

#### Manual Setup

1. Create PostgreSQL database:
```sql
CREATE DATABASE construction_pricing;
```

2. Start Redis server:
```bash
redis-server
```

### 5. Run Database Migrations

```bash
cd packages/backend
npm run db:generate
npm run db:migrate
```

### 6. Seed Database (Optional)

```bash
npm run db:seed
```

### 7. Start Development Servers

From the root directory:
```bash
npm run dev
```

This starts both backend (port 8000) and frontend (port 3000).

Or start separately:
```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

## Verification

### Backend
- API: http://localhost:8000
- Health check: http://localhost:8000/health

### Frontend
- Web app: http://localhost:3000

### Database
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Development Workflow

### Backend Development

1. Make changes in `packages/backend/src/`
2. Server auto-reloads with `tsx watch`
3. Check logs in `packages/backend/logs/`

### Frontend Development

1. Make changes in `packages/frontend/src/`
2. Next.js hot-reloads automatically
3. Check browser console for errors

### Database Changes

1. Modify `packages/backend/prisma/schema.prisma`
2. Generate Prisma client:
   ```bash
   npm run db:generate
   ```
3. Create migration:
   ```bash
   npm run db:migrate
   ```

## Troubleshooting

### Port Already in Use

**Backend (8000):**
```bash
# Find process
netstat -ano | findstr :8000
# Kill process (Windows)
taskkill /PID <pid> /F
```

**Frontend (3000):**
```bash
# Find process
netstat -ano | findstr :3000
# Kill process
taskkill /PID <pid> /F
```

### Database Connection Error

1. Verify PostgreSQL is running
2. Check DATABASE_URL in .env
3. Verify database exists
4. Check PostgreSQL logs

### Redis Connection Error

1. Verify Redis is running
2. Check REDIS_URL in .env
3. Test connection:
   ```bash
   redis-cli ping
   ```

### Module Not Found

1. Delete node_modules:
   ```bash
   rm -rf node_modules packages/*/node_modules
   ```
2. Reinstall:
   ```bash
   npm install
   ```

## Production Setup

### Build

```bash
npm run build
```

### Start Production Servers

```bash
# Backend
cd packages/backend
npm start

# Frontend
cd packages/frontend
npm start
```

### Environment Variables

Set production environment variables:
- Use secure JWT secrets
- Set NODE_ENV=production
- Configure production database
- Set up SSL certificates

## Next Steps

- Review [Architecture](./architecture.md) for system design
- Check [API Reference](./api-reference.md) for endpoints
- See [Deployment Guide](./deployment.md) for production setup












