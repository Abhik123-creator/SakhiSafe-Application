# SakhiSafe Application

## Central Docker Setup

From this root folder, start PostgreSQL, the NestJS backend, and the Next.js frontend together:

```bash
docker compose up -d --build
```

Frontend: `http://localhost:3000`

Backend API: `http://localhost:4000`

Swagger: `http://localhost:4000/api/docs`

Nestlens: `http://localhost:4000/nestlens`

This keeps `SakhiSafe-Frontend` and `SakhiSafe-Backend` as separate projects while giving you one central Docker command for local development.

## Live Reload Development

Use the dev compose override when you want frontend/backend source changes to update without rebuilding images every time:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Then use the same URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`

Normal code changes should reload automatically. If the browser does not update immediately, refresh the page.

Rebuild only when dependencies, Dockerfiles, or generated Prisma output changes:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

To return to production-style containers:

```bash
docker compose down
docker compose up -d --build
```
