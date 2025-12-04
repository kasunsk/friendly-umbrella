# Architecture Documentation

Technical architecture overview of the Construction Pricing Platform.

## System Overview

The Construction Pricing Platform is a full-stack application built with modern web technologies, designed to facilitate real-time pricing between construction suppliers and companies.

## Technology Stack

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Authentication**: JWT + Refresh Tokens
- **WebSocket**: Socket.io
- **Validation**: Zod + Express Validator

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18+
- **Styling**: Tailwind CSS
- **State Management**: React Context + TanStack Query
- **Authentication**: JWT tokens stored in localStorage
- **WebSocket Client**: Socket.io Client

### Infrastructure
- **Monorepo**: npm workspaces
- **Package Manager**: npm
- **Containerization**: Docker
- **CI/CD**: GitHub Actions

## System Architecture

```
┌─────────────────┐
│   Frontend      │
│   (Next.js)     │
│   Port: 3000    │
└────────┬────────┘
         │ HTTP/WebSocket
         │
┌────────▼────────┐
│   Backend API   │
│   (Express)     │
│   Port: 8000    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│  PG   │ │ Redis │
│  DB   │ │ Cache │
└───────┘ └───────┘
```

## Database Schema

### Core Entities

#### Tenant
- Represents suppliers or companies
- Fields: id, name, type, email, phone, address, isActive
- Type: 'supplier' | 'company'

#### User
- User accounts across tenants
- Fields: id, email, password (hashed), firstName, lastName, role, tenantId
- Relationship: Belongs to Tenant

#### Product
- Supplier product catalog
- Fields: id, sku, name, description, category, unit, supplierId, isActive
- Relationship: Belongs to Supplier (Tenant)

#### DefaultPrice
- Prices visible to all companies
- Fields: id, productId, price, currency, effectiveFrom, effectiveUntil, isActive
- Relationship: Belongs to Product

#### PrivatePrice
- Company-specific prices
- Fields: id, productId, companyId, price, currency, effectiveFrom, effectiveUntil, notes, isActive
- Relationships: Belongs to Product and Company (Tenant)

#### PriceAuditLog
- Audit trail for price changes
- Fields: id, priceId, priceType, userId, oldPrice, newPrice, changedAt, ipAddress, userAgent

## API Architecture

### Route Structure

```
/api/v1/
├── auth/
│   ├── POST   /register
│   ├── POST   /login
│   ├── POST   /refresh
│   └── GET    /me
├── products/          (Supplier only)
│   ├── GET    /
│   ├── GET    /stats
│   ├── GET    /:id
│   ├── POST   /
│   ├── PUT    /:id
│   └── DELETE /:id
├── products/:id/
│   ├── PUT    /default-price
│   ├── POST   /private-prices
│   ├── GET    /private-prices
│   └── GET    /price-history
├── private-prices/    (Supplier only)
│   ├── PUT    /:id
│   └── DELETE /:id
└── suppliers/         (Company only)
    ├── GET    /
    ├── GET    /:id
    └── GET    /:id/products
```

### Authentication Flow

1. User registers/logs in
2. Backend creates JWT tokens (access + refresh)
3. Frontend stores tokens in localStorage
4. All API requests include `Authorization: Bearer {token}`
5. Tokens validated by middleware
6. Refresh token used to get new access token

### Authorization

- **Role-based**: Users have roles (supplier_admin, company_admin)
- **Tenant-based**: Users belong to tenants (suppliers or companies)
- **Route protection**: Middleware checks tenant type and authentication

## WebSocket Architecture

### Connection Flow

1. Client connects to WebSocket server
2. Client sends authentication token
3. Server validates token
4. Client joins tenant-specific room
5. Server broadcasts price updates to room

### Events

- `price:updated` - Broadcast when prices change
- `price:created` - New price added
- `product:created` - New product added

## Security

### Authentication
- JWT tokens with expiration
- Refresh token rotation
- Password hashing with bcrypt

### Authorization
- Middleware-based route protection
- Tenant type validation
- Role-based access control

### Data Protection
- Input validation (Zod schemas)
- SQL injection prevention (Prisma ORM)
- XSS protection (React escaping)
- CORS configuration

## Performance

### Caching Strategy
- Redis for session data
- Product catalog caching
- Price query optimization

### Database Optimization
- Indexed foreign keys
- Query optimization
- Connection pooling

### Frontend Optimization
- Code splitting
- Lazy loading
- React Query caching

## Deployment

### Development
- Local development servers
- Hot reload enabled
- Development databases

### Production
- Docker containers
- Environment variables
- Database migrations
- Health checks

## Monitoring

### Logging
- Winston logger
- Error tracking
- Request logging

### Metrics
- API response times
- Error rates
- Database query performance

## Future Enhancements

- GraphQL API
- Microservices architecture
- Message queue for async processing
- Advanced analytics
- Mobile applications












