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
