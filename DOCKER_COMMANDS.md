# SakhiSafe Docker Commands

Run these commands from the project root:

```powershell
cd E:\SakhiSafe-Application
```

## Start And Stop

```powershell
docker compose up -d
docker compose down
docker compose ps
```

## Logs

```powershell
docker compose logs backend
docker compose logs frontend
docker compose logs postgres
```

Follow logs live:

```powershell
docker compose logs -f backend
docker compose logs -f frontend
```

## Rebuild After Code Changes

Rebuild everything:

```powershell
docker compose up -d --build
```

Rebuild backend and frontend:

```powershell
docker compose up -d --build backend frontend
```

Rebuild only backend:

```powershell
docker compose up -d --build backend
```

Rebuild only frontend:

```powershell
docker compose up -d --build frontend
```

Force recreate if Docker still serves old code:

```powershell
docker compose up -d --force-recreate backend
docker compose up -d --force-recreate frontend
```

## Prisma

Generate Prisma Client:

```powershell
docker compose exec backend npx prisma generate
```

Validate Prisma schema:

```powershell
docker compose exec backend npx prisma validate
```

Check migration status:

```powershell
docker compose exec backend npx prisma migrate status
```

Apply migrations:

```powershell
docker compose exec backend npx prisma migrate deploy
```

Create a new development migration:

```powershell
docker compose exec backend npx prisma migrate dev --name your_migration_name
```

Mark an existing migration as applied:

```powershell
docker compose exec backend npx prisma migrate resolve --applied migration_folder_name
```

## Database

Open Postgres shell:

```powershell
docker compose exec postgres psql -U sakhisafe_user -d sakhi_safe_app
```

Run one SQL command:

```powershell
docker compose exec postgres psql -U sakhisafe_user -d sakhi_safe_app -c "select now();"
```

List tables:

```powershell
docker compose exec postgres psql -U sakhisafe_user -d sakhi_safe_app -c "\dt"
```

Check incident tables:

```powershell
docker compose exec postgres psql -U sakhisafe_user -d sakhi_safe_app -c "select table_name from information_schema.tables where table_schema='public' and table_name in ('ConversationSession','ConversationMessage','Incident');"
```

## Seed

```powershell
docker compose exec backend npm run seed
```

Default seeded admin:

```txt
Email: admin@sakhisafe.local
Password: Admin@12345
```

## Backend

Build:

```powershell
docker compose exec backend npm run build
```

Test:

```powershell
docker compose exec backend npm test
```

Generate Swagger JSON:

```powershell
docker compose exec backend npm run swagger:generate
```

Swagger UI:

```txt
http://localhost:4000/api-docs
http://localhost:4000/internal-docs
http://localhost:4000/webhook-docs
```

Swagger JSON:

```txt
http://localhost:4000/api-docs-json
http://localhost:4000/internal-docs-json
http://localhost:4000/webhook-docs-json
```

## Frontend

Build:

```powershell
docker compose exec frontend npm run build
```

Because the frontend runs as a production Next.js container, rebuild after frontend code changes:

```powershell
docker compose up -d --build frontend
```

Open app:

```txt
http://localhost:3000
```

Incident dashboard:

```txt
http://localhost:3000/dashboard/incidents
```

## Reset

Stop containers but keep database data:

```powershell
docker compose down
```

Stop containers and delete database volume:

```powershell
docker compose down -v
```

Fresh rebuild:

```powershell
docker compose up -d --build
```
