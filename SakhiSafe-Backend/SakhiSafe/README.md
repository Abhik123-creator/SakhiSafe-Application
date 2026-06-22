# SakhiSafe

SakhiSafe is a production-style backend scaffold for a WhatsApp-based domestic violence safety assistant.

## Architecture

- `messaging-service`: FastAPI service on port `8000` for the WhatsApp webhook adapter.
- `ai-service`: FastAPI service on port `8080` for the agent-based domestic violence safety assistant.
- `postgres`: PostgreSQL 16 database used by `ai-service`.

## Layout

```text
SakhiSafe/
|-- docker-compose.yml
|-- README.md
|-- messaging-service/
`-- ai-service/
```

## Responsibilities

- `messaging-service` handles WhatsApp webhook verification, WhatsApp payload normalization, and forwarding messages to `ai-service`.
- `ai-service` handles agent orchestration, prompt loading, LLM abstraction, tool calls, and PostgreSQL persistence.
- `postgres` is used only by `ai-service`.

## Compose Notes

- `ai-service` waits for PostgreSQL to become healthy.
- `messaging-service` waits for `ai-service` to become healthy.
- Service directories are mounted for hot reload development.
- PostgreSQL data and media uploads are persisted with named Docker volumes.
- Compose reads service-specific environment files from `./messaging-service/.env` and `./ai-service/.env`.

## Run Locally

1. Copy placeholder environment files:

```powershell
Copy-Item .env.example .env
Copy-Item .\messaging-service\.env.example .\messaging-service\.env
Copy-Item .\ai-service\.env.example .\ai-service\.env
```

2. Start the stack:

```powershell
docker compose up --build
```

3. Check health:

```powershell
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8080/health
```

4. Send a local test message directly to `ai-service`:

```powershell
$body = @{
  source = "whatsapp"
  message_id = "local-test-1"
  sender = @{ id = "demo-user"; phone = "+10000000000" }
  message = @{ type = "text"; text = "I am scared and need help" }
  received_at = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri http://localhost:8080/messaging -ContentType "application/json" -Body $body
```

The WhatsApp credentials in `.env.example` are placeholders only. Set real values through your deployment secret manager before using Meta WhatsApp Cloud API in a real environment.
