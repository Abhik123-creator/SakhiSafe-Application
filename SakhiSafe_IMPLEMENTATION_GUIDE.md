# SakhiSafe Backend + Frontend Build Guide

This guide combines the final decisions for the current version of SakhiSafe.

The goal is to use the existing Next.js dashboard template as the frontend and create a separate NestJS backend from scratch. The backend will use PostgreSQL, Prisma, Passport authentication, Swagger, Nestlens, Pino logging, global exception handling, audit logs, and a clean MVC-style controller-service-repository architecture.

---

## 1. Final Current Decision

For now, keep the project simple and clean.

```txt
Frontend repo: SakhiSafe-Application
Backend repo:  SakhiSafe-Backend
AI service:    separate Python project later
```

Do not use a monorepo right now.

Do not add Redis, BullMQ, or queues right now.

Do not add the Python AI service inside the NestJS backend.

---

## 2. Final Current Architecture

```txt
SakhiSafe-Application
Next.js dashboard frontend
        |
        | HTTP API calls
        v
SakhiSafe-Backend
NestJS backend API
        |
        | Prisma ORM
        v
PostgreSQL + pgvector
Application data + future RAG metadata/vector support
```

Later, the Python AI service can be added separately:

```txt
SakhiSafe-AI-Service
Python / FastAPI / Gemini / RAG pipeline
```

---

## 3. What to Use Now

### Frontend

Use the existing repository:

```txt
SakhiSafe-Application
```

Use it only as the frontend dashboard.

Frontend stack:

```txt
Next.js
React
TypeScript
ShadCN UI
Tailwind CSS
Zustand
TanStack Query
React Hook Form
Zod
Axios
TanStack Table
Recharts
```

Use Zustand only for local UI state:

```txt
sidebar open/closed
selected filters
current dashboard tab
temporary UI preferences
local auth/session UI state
```

Use TanStack Query for server data:

```txt
users
roles
organizations
cases
persons at risk
audit logs
health status
```

---

### Backend

Create a new separate NestJS project:

```txt
SakhiSafe-Backend
```

Backend stack:

```txt
NestJS
TypeScript
Prisma
PostgreSQL
pgvector image for PostgreSQL
Passport.js
Passport Local Strategy
Passport JWT Strategy
JWT
bcrypt
Swagger/OpenAPI
Nestlens
nestjs-pino / Pino
class-validator
class-transformer
helmet
compression
cookie-parser
Jest
Supertest
```

---

## 4. What Not to Use Now

Do not implement these in this stage:

```txt
Redis
BullMQ
Bull Board
Queue workers
Monorepo
Python AI service inside backend
Qdrant
Microservices
```

These can be added later after the basic backend and dashboard work correctly.

---

## 5. Docker Scope for Now

Use Docker only for database infrastructure.

Use:

```txt
PostgreSQL with pgvector image
Optional pgAdmin
```

Do not add Redis or queue containers now.

### docker-compose.yml

Create this in `SakhiSafe-Backend/docker-compose.yml`:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: sakhisafe_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: sakhisafe
      POSTGRES_USER: sakhisafe_user
      POSTGRES_PASSWORD: sakhisafe_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  pgadmin:
    image: dpage/pgadmin4
    container_name: sakhisafe_pgadmin
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@sakhisafe.local
      PGADMIN_DEFAULT_PASSWORD: admin123
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

Run:

```bash
docker compose up -d
```

PostgreSQL:

```txt
localhost:5432
```

pgAdmin:

```txt
http://localhost:5050
```

---

## 6. Backend Environment Variables

Create `.env.example` in `SakhiSafe-Backend`:

```env
NODE_ENV=development
APP_NAME=SakhiSafe Backend
APP_PORT=4000
FRONTEND_URL=http://localhost:3000

DATABASE_URL=postgresql://sakhisafe_user:sakhisafe_password@localhost:5432/sakhisafe?schema=public

JWT_SECRET=change_this_to_a_long_random_secret
JWT_EXPIRES_IN=1d

BCRYPT_SALT_ROUNDS=10
```

Create `.env` from `.env.example` locally.

---

## 7. Backend Package Installation

Inside `SakhiSafe-Backend`, install:

```bash
npm install @nestjs/config
npm install @nestjs/swagger swagger-ui-express
npm install class-validator class-transformer
npm install prisma @prisma/client
npm install pg

npm install @nestjs/passport passport passport-local passport-jwt
npm install @nestjs/jwt bcrypt
npm install -D @types/passport-local @types/passport-jwt @types/bcrypt

npm install helmet compression cookie-parser
npm install -D @types/compression @types/cookie-parser

npm install nestjs-pino pino-http pino-pretty
npm install nestlens

npm install @casl/ability

npm install -D jest ts-jest @types/jest
npm install -D supertest @types/supertest
npm install -D @nestjs/testing
```

Initialize Prisma:

```bash
npx prisma init
```

---

## 8. MVC-Style NestJS Architecture

Use this pattern everywhere:

```txt
Controller  -> handles HTTP request/response only
DTO         -> validates input
Service     -> contains business logic
Repository  -> contains database queries
Model       -> Prisma schema model
Guard       -> authentication/authorization
Filter      -> exception handling
Interceptor -> logging/response/audit behavior
```

Example request flow:

```txt
POST /cases
   |
   v
CasesController
   |
   v
CreateCaseDto
   |
   v
CasesService
   |
   v
CasesRepository
   |
   v
PrismaService
   |
   v
PostgreSQL
```

Rules:

```txt
Controllers must stay thin.
Controllers must not call Prisma directly.
Services must contain business rules.
Repositories must contain database queries.
DTOs must validate all request input.
Sensitive data must never be logged raw.
All errors must go through global exception handling.
All successful responses must use a standard response shape.
```

---

## 9. Backend Folder Structure

Use this structure:

```txt
src/
  main.ts
  app.module.ts

  common/
    decorators/
      current-user.decorator.ts
      roles.decorator.ts
    filters/
      global-exception.filter.ts
    guards/
      roles.guard.ts
    interceptors/
      transform-response.interceptor.ts
      audit-log.interceptor.ts
    middleware/
      request-id.middleware.ts
    utils/
      mask-sensitive-data.util.ts
      password.util.ts
    constants/
      roles.constant.ts

  config/
    app.config.ts
    database.config.ts
    auth.config.ts

  prisma/
    prisma.module.ts
    prisma.service.ts

  auth/
    controllers/
      auth.controller.ts
    services/
      auth.service.ts
    strategies/
      local.strategy.ts
      jwt.strategy.ts
    guards/
      local-auth.guard.ts
      jwt-auth.guard.ts
    dto/
      login.dto.ts

  users/
    controllers/
      users.controller.ts
    services/
      users.service.ts
    repositories/
      users.repository.ts
    dto/
      create-user.dto.ts
      update-user.dto.ts

  roles/
    controllers/
      roles.controller.ts
    services/
      roles.service.ts
    repositories/
      roles.repository.ts
    dto/
      create-role.dto.ts

  organizations/
    controllers/
      organizations.controller.ts
    services/
      organizations.service.ts
    repositories/
      organizations.repository.ts
    dto/
      create-organization.dto.ts
      update-organization.dto.ts

  persons-at-risk/
    controllers/
      persons-at-risk.controller.ts
    services/
      persons-at-risk.service.ts
    repositories/
      persons-at-risk.repository.ts
    dto/
      create-person-at-risk.dto.ts
      update-person-at-risk.dto.ts

  cases/
    controllers/
      cases.controller.ts
    services/
      cases.service.ts
    repositories/
      cases.repository.ts
    dto/
      create-case.dto.ts
      update-case.dto.ts

  audit/
    controllers/
      audit.controller.ts
    services/
      audit.service.ts
    repositories/
      audit.repository.ts
    dto/
      create-audit-log.dto.ts

  health/
    health.controller.ts
    health.module.ts
    health.service.ts
```

---

## 10. Core Backend Modules for First Version

Build these first:

```txt
health
prisma
common infrastructure
auth
users
roles
organizations
persons-at-risk
cases
audit
```

Add later:

```txt
messages
incidents
safety-logs
evidence
rag
AI integration
WhatsApp messaging integration
```

---

## 11. Authentication Requirements

Use Passport.js.

Implement:

```txt
Passport Local Strategy for email/password login
Passport JWT Strategy for protected routes
JWT access token
bcrypt password hashing
CurrentUser decorator
JwtAuthGuard
LocalAuthGuard
```

Auth endpoints:

```txt
POST /auth/login
GET /auth/me
```

Login response:

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt_token_here",
    "user": {
      "id": "uuid",
      "email": "admin@sakhisafe.local",
      "name": "System Admin",
      "roles": ["SUPER_ADMIN"]
    }
  },
  "meta": {},
  "requestId": "req_xxx"
}
```

---

## 12. Authorization Requirements

Start with role-based authorization.

Roles:

```txt
SUPER_ADMIN
SYSTEM_ADMIN
NGO_ADMIN
NGO_WORKER
ERT_ADMIN
ERT_RESPONDER
GOV_ADMIN
CASE_MANAGER
COUNSELLOR
LEGAL_ADVISOR
AI_SERVICE
MESSAGING_SERVICE
```

Implement:

```txt
@Roles(...roles)
RolesGuard
```

Keep the code structured so CASL can be added later for advanced permissions.

Later CASL will handle rules like:

```txt
NGO_WORKER can view only assigned cases.
GOV_ADMIN can view statistics but not victim identity.
AI_SERVICE can create message logs but cannot export evidence.
```

---

## 13. Prisma Models Required First

Use UUID primary keys, timestamps, and soft delete where useful.

Models:

```txt
User
Role
UserRole
Organization
PersonAtRisk
Case
AuditLog
```

Enums:

```txt
RoleName
OrganizationType
CaseStatus
RiskLevel
AuditAction
```

Use `PersonAtRisk` instead of `Victim` in code to make the app safer and less exposed.

Sensitive fields should be prepared for encryption/masking later:

```txt
person name
phone number
address
case summary
notes
```

---

## 14. Logging Requirements

Use three separate concepts:

```txt
Nestlens   -> Telescope-like development/debug visibility
Pino       -> structured application logs
AuditLog   -> security/legal trail for sensitive actions
```

### Pino Logging

Log:

```txt
requestId
method
path
statusCode
durationMs
userId if available
role if available
```

Never log raw sensitive information.

Mask:

```txt
password
token
authorization header
phone
name
address
message content
incident description
evidence data
case notes
```

### Nestlens

Use Nestlens as the Telescope-like debugging tool.

Rules:

```txt
Do not expose Nestlens publicly.
Protect it in production.
Disable or restrict it if sensitive data may leak.
Make sure sensitive fields are masked before logs/debug output.
```

### AuditLog

Audit logs must store security-sensitive actions:

```txt
user login
case viewed
case created
case updated
person-at-risk viewed
person-at-risk updated
organization created
organization updated
role changed
```

AuditLog fields:

```txt
id
actorUserId
action
entityType
entityId
ipAddress masked
userAgent
metadata JSON
createdAt
```

---

## 15. Global Exception Handling

Create `GlobalExceptionFilter`.

All errors should return:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe user-facing message"
  },
  "requestId": "req_xxx"
}
```

Handle:

```txt
Validation errors
Unauthorized errors
Forbidden errors
Not found errors
Prisma known request errors
Internal server errors
```

Do not expose raw stack traces in production.

---

## 16. Global Response Formatting

Create `TransformResponseInterceptor`.

All successful responses should return:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "requestId": "req_xxx"
}
```

---

## 17. Request ID Middleware

Every request must get a request ID.

Use header if provided:

```txt
x-request-id
```

Otherwise generate one.

Attach it to:

```txt
request object
response header
logs
error response
success response
```

---

## 18. Swagger Requirements

Swagger should be available at:

```txt
/api/docs
```

Use:

```txt
@ApiTags
@ApiOperation
@ApiResponse
@ApiBearerAuth
DTO decorators
```

In production, Swagger should be protected or disabled.

---

## 19. Health Endpoint

Create:

```txt
GET /health
```

Return:

```json
{
  "status": "ok",
  "database": "ok",
  "timestamp": "2026-05-31T00:00:00.000Z"
}
```

---

## 20. Seed Requirements

Create Prisma seed script for:

```txt
SUPER_ADMIN role
SYSTEM_ADMIN role
NGO_ADMIN role
NGO_WORKER role
default admin user
sample NGO organization
```

Default admin for local development:

```txt
email: admin@sakhisafe.local
password: Admin@12345
```

This password must be changed outside local development.

---

## 21. Testing Requirements

Add initial tests:

```txt
health endpoint test
auth login test
roles guard test
users service test
cases service test
```

Use:

```txt
Jest
Supertest
@nestjs/testing
```

---

## 22. Frontend Integration Later

After backend is working, connect the existing frontend.

Frontend API base URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Frontend should implement:

```txt
Axios API client
Login connected to POST /auth/login
/auth/me connected to GET /auth/me
Protected dashboard routes
Role-based sidebar
Cases page
Case details page
Organizations page
Users page
Persons-at-risk page
Audit logs page
System health page
```

Do not store all backend data in Zustand.

Use:

```txt
Zustand -> local UI/auth state
TanStack Query -> server data
```

---

## 23. Build Order for Coding LLM

Ask the coding LLM to implement in this exact order:

```txt
1. Create/verify separate NestJS backend project.
2. Add package dependencies.
3. Add docker-compose.yml for PostgreSQL + pgAdmin.
4. Add .env.example.
5. Configure Prisma with PostgreSQL.
6. Create Prisma schema.
7. Add PrismaService and PrismaModule.
8. Configure main.ts with validation, CORS, helmet, compression, Swagger, logging, filters, interceptors.
9. Add common infrastructure: request ID middleware, global exception filter, response interceptor, masking utility.
10. Add auth module with Passport Local + Passport JWT.
11. Add users and roles modules.
12. Add organizations module.
13. Add persons-at-risk module.
14. Add cases module.
15. Add audit module.
16. Add health module.
17. Add seed script.
18. Add initial tests.
19. Add README setup commands.
```

---

---

## 24. Prompt File

The copy-paste coding LLM prompt has been separated into `SakhiSafe_CODING_PROMPT.md`.
