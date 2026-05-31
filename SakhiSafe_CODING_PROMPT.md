## 24. Single Prompt for Coding LLM

Copy the following prompt and give it to your coding LLM.

```txt
I have two separate repositories:

1. Frontend repository:
SakhiSafe-Application
This is an existing Next.js admin dashboard template. Keep it separate. Do not convert it into a monorepo. Do not add backend code inside this frontend repo right now.

2. Backend repository:
SakhiSafe-Backend
This should be a separate NestJS backend project.

Important decisions:
- Do not create a monorepo.
- Do not use Redis now.
- Do not use BullMQ now.
- Do not use queues now.
- Do not include Python AI service inside this backend.
- Python AI service will be a separate project later.
- Use Docker only for PostgreSQL and optional pgAdmin.
- Use PostgreSQL with pgvector image.
- Use Prisma ORM.
- Use Passport.js for authentication.
- Use Passport Local Strategy for email/password login.
- Use Passport JWT Strategy for protected routes.
- Use JWT access tokens.
- Use bcrypt for password hashing.
- Use Swagger/OpenAPI.
- Use Nestlens for Laravel Telescope-like debugging.
- Use nestjs-pino/Pino for structured logging.
- Use global exception handling.
- Use global response formatting.
- Use request ID middleware.
- Use audit logs for sensitive actions.
- Use MVC-style NestJS architecture: controller, service, repository, DTO, Prisma model.
- Follow clean coding practices.

Backend tech stack:
- NestJS
- TypeScript
- Prisma
- PostgreSQL
- pgvector PostgreSQL Docker image
- Passport.js
- passport-local
- passport-jwt
- @nestjs/jwt
- bcrypt
- Swagger/OpenAPI
- Nestlens
- nestjs-pino
- class-validator
- class-transformer
- helmet
- compression
- cookie-parser
- Jest
- Supertest

Create this backend folder structure:

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

Implement root-level docker-compose.yml inside SakhiSafe-Backend with:
- postgres using pgvector/pgvector:pg16
- pgAdmin optional
- no Redis
- no BullMQ

Create .env.example with:
- NODE_ENV
- APP_NAME
- APP_PORT=4000
- FRONTEND_URL=http://localhost:3000
- DATABASE_URL
- JWT_SECRET
- JWT_EXPIRES_IN
- BCRYPT_SALT_ROUNDS

Implement Prisma schema with these models:
- User
- Role
- UserRole
- Organization
- PersonAtRisk
- Case
- AuditLog

Use UUID primary keys.
Use createdAt and updatedAt.
Use deletedAt for soft delete where useful.
Use PostgreSQL enums for:
- RoleName
- OrganizationType
- CaseStatus
- RiskLevel
- AuditAction

Use PersonAtRisk instead of Victim in code.

Implement authentication:
- POST /auth/login
- GET /auth/me
- Passport Local Strategy
- Passport JWT Strategy
- JwtAuthGuard
- LocalAuthGuard
- CurrentUser decorator
- bcrypt password verification
- JWT token generation

Implement authorization:
- @Roles decorator
- RolesGuard
- roles attached to users
- protect admin endpoints by role
- keep CASL optional for later, but structure the code so CASL can be added later

Implement global backend infrastructure in main.ts:
- ConfigService
- ValidationPipe with whitelist and transform
- Helmet
- Compression
- Cookie parser
- CORS for FRONTEND_URL
- Swagger at /api/docs
- GlobalExceptionFilter
- TransformResponseInterceptor
- request ID middleware
- Pino logger
- Nestlens setup if package supports direct module integration

Implement fixed logging mechanism:
- Add requestId to every request.
- Log method, path, statusCode, durationMs, userId if available.
- Use nestjs-pino/Pino for structured logs.
- Add masking utility for sensitive fields.
- Mask password, token, authorization header, phone, name, address, case notes, message content, incident description, evidence data.
- Never log raw person-at-risk sensitive data.
- Never log raw victim safety information.

Implement GlobalExceptionFilter:
All errors must return:
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe user-facing message"
  },
  "requestId": "req_xxx"
}

Handle:
- validation errors
- unauthorized errors
- forbidden errors
- not found errors
- Prisma known request errors
- internal server errors

Implement TransformResponseInterceptor:
All successful responses must return:
{
  "success": true,
  "data": {},
  "meta": {},
  "requestId": "req_xxx"
}

Implement AuditModule:
Audit these actions:
- user login
- case viewed
- case created
- case updated
- person-at-risk viewed
- person-at-risk updated
- organization created
- organization updated
- role changed

AuditLog fields:
- id
- actorUserId
- action
- entityType
- entityId
- ipAddress masked
- userAgent
- metadata JSON
- createdAt

Implement Health endpoint:
GET /health
Return app status, database status, and timestamp.

Implement seed script:
- SUPER_ADMIN role
- SYSTEM_ADMIN role
- NGO_ADMIN role
- NGO_WORKER role
- default admin user
- sample NGO organization

Default local admin:
email: admin@sakhisafe.local
password: Admin@12345

Add initial tests:
- health endpoint test
- auth login test
- roles guard test
- users service test
- cases service test

Coding rules:
- Controllers must be thin.
- Controllers must never call Prisma directly.
- Services contain business logic.
- Repositories contain all database queries.
- DTOs validate all request bodies.
- Use ConfigService, no hardcoded secrets.
- Use safe error messages.
- Do not expose stack traces in production.
- Do not add Redis, BullMQ, queue workers, or Python service now.

Generate the implementation step by step in this order:
1. package installation commands
2. docker-compose.yml
3. .env.example
4. Prisma schema
5. PrismaService and PrismaModule
6. main.ts setup
7. common infrastructure
8. auth module
9. users and roles modules
10. organizations module
11. persons-at-risk module
12. cases module
13. audit module
14. health module
15. seed script
16. tests
17. README setup instructions
```

---

## 25. Frontend Prompt for Later

Use this only after the backend works.

```txt
I have a separate Next.js dashboard repository called SakhiSafe-Application.

Connect it to my NestJS backend API running at:
http://localhost:4000

Do not rebuild the frontend from scratch.
Use the existing dashboard template and gradually replace demo content.

Frontend stack:
- Next.js
- React
- TypeScript
- ShadCN UI
- Tailwind CSS
- Zustand
- TanStack Query
- React Hook Form
- Zod
- Axios

Implement:
1. API client using Axios.
2. NEXT_PUBLIC_API_URL support.
3. Auth store using Zustand only for local auth/session UI state.
4. TanStack Query for server data.
5. Login page connected to POST /auth/login.
6. /auth/me integration.
7. Protected dashboard routes.
8. Role-based sidebar items.
9. Cases list page.
10. Case detail page.
11. Organizations page.
12. Users page.
13. Persons-at-risk page.
14. Audit logs page.
15. System health page.

Rules:
- Do not store all API data in Zustand.
- Use TanStack Query for server state.
- Use Zod schemas for forms.
- Use React Hook Form for forms.
- Show loading, error, and empty states.
- Never expose sensitive person-at-risk data unless the logged-in role has permission.
```
