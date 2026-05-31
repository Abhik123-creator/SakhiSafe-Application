# SakhiSafe Backend

Standalone NestJS backend for SakhiSafe. This is intentionally separate from the frontend and does not include Redis, BullMQ, queues, or the future Python AI service.

## Package Installation Commands

```bash
npm install
npm run prisma:generate
```

The dependencies in `package.json` cover NestJS, Prisma, Passport Local/JWT auth, bcrypt, Swagger, Nestlens, nestjs-pino, validation, PostgreSQL, Jest, and Supertest.

## Local Setup

```bash
cp .env.example .env
docker compose up -d
npm run prisma:migrate -- --name init
npm run seed
npm run start:dev
```

API: `http://localhost:4000`

Swagger: `http://localhost:4000/api/docs`

Nestlens: `http://localhost:4000/nestlens` in non-production only.

Health: `GET http://localhost:4000/health`

pgAdmin: `http://localhost:5050`

## Default Local Admin

```txt
email: admin@sakhisafe.local
password: Admin@12345
```

Change this password outside local development.

## Scripts

```bash
npm run build
npm test
npm run test:e2e
npm run prisma:studio
```

## Notes

- Controllers stay thin and call services only.
- Services contain business logic.
- Repositories contain Prisma queries.
- Successful responses are globally formatted.
- Errors are globally formatted with safe messages.
- Request IDs are attached to requests, responses, logs, and envelopes.
- Sensitive fields are masked before structured logging and audit metadata.
