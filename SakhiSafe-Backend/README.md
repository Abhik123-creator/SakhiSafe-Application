# SakhiSafe Backend

Standalone NestJS backend for SakhiSafe. This is intentionally separate from the frontend and does not include Redis, BullMQ, queues, or the future Python AI service.

## Package Installation Commands

```bash
npm install
npm run prisma:generate
```

The dependencies in `package.json` cover NestJS, Prisma, Passport Local/JWT auth, bcrypt, Swagger, Nestlens, nestjs-pino, validation, PostgreSQL, Jest, and Supertest.

## Local Setup

For Docker-first setup:

```bash
cp .env.example .env
docker compose up -d --build
```

The default `.env.example` uses `postgres` as the database host because the backend runs inside Docker and connects to the `postgres` Compose service.

For non-Docker local development, change `DATABASE_URL` in `.env` from host `postgres` to `localhost`, then run:

```bash
npm run prisma:migrate -- --name init
npm run seed
npm run start:dev
```

## Docker Backend Setup

To start PostgreSQL and the NestJS backend together:

```bash
docker compose up --build
```

Backend API: `http://localhost:${APP_PORT:-4000}`

The backend container runs Prisma `db push`, seeds the default data, and then starts NestJS automatically.

Swagger: `http://localhost:${APP_PORT:-4000}/api/docs`

Nestlens: `http://localhost:${APP_PORT:-4000}/nestlens` in non-production only.

Health: `GET http://localhost:${APP_PORT:-4000}/health`

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
