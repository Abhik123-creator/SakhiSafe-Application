# SakhiSafe AI Service

Basic FastAPI skeleton for the SakhiSafe WhatsApp-based women safety assistant.

## Run Locally

```bash
python -m venv venv
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

## Endpoints

### Health

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "service": "sakhi-ai-service"
}
```

### Messaging

```http
POST /messaging
```

Request:

```json
{
  "source": "whatsapp",
  "message_id": "wamid.test",
  "timestamp": 1779262164,
  "sender": {
    "id": "917003801171",
    "name": "Test User",
    "platform_metadata": {
      "wa_id": "917003801171"
    }
  },
  "message": {
    "text": "hello",
    "type": "text",
    "button_id": null,
    "metadata": {}
  },
  "media": null,
  "raw": {}
}
```

Response:

```json
{
  "status": "success",
  "received": true,
  "is_json": true,
  "response": "<final AI reply>",
  "agent": "general_agent",
  "risk_level": "low"
}
```

## Optional LLM Providers

`LLM_PROVIDER` chooses the provider used for supervisor routing and optional specialist-agent replies. Currently supported providers:

- `gemini` through Vertex AI with Google Application Default Credentials
- `anthropic` or `claude`

The LLM supervisor only chooses the route. It does not generate final user replies and does not execute tools. If it is disabled, misconfigured, or returns invalid JSON, SakhiSafe falls back to the keyword supervisor.

LLM agent responses write the final WhatsApp wording after Python routing and tools have already run. If the LLM is disabled, missing, fails, returns empty text, or is rejected by the safety filter, SakhiSafe returns a clear temporary-unavailable message instead of static fallback content.

To use Gemini through Vertex AI:

1. Authenticate locally:

```bash
gcloud auth application-default login
gcloud config set project <project-id>
gcloud services enable aiplatform.googleapis.com
```

2. Put the project settings in `.env` / `ai-service/.env`:

```env
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=your-google-cloud-project-id
GOOGLE_CLOUD_LOCATION=global
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
GEMINI_MODEL=gemini-2.5-flash
LLM_SUPERVISOR_TEMPERATURE=0.1
LLM_AGENT_TEMPERATURE=0.7
LLM_MAX_OUTPUT_TOKENS=700
LLM_THINKING_BUDGET=0
LLM_AGENT_MAX_CHARS=900
ENABLE_LLM_SUPERVISOR=true
ENABLE_LLM_AGENT_RESPONSES=true
```

Supervisor routing uses `LLM_SUPERVISOR_TEMPERATURE` so JSON decisions stay strict and consistent. Specialist final replies use `LLM_AGENT_TEMPERATURE` so replies can feel warmer and more human. `LLM_MAX_OUTPUT_TOKENS` applies to both. For Gemini thinking models, `LLM_THINKING_BUDGET=0` keeps short WhatsApp replies from using the full output budget on hidden reasoning. SakhiSafe does not trim valid user-facing LLM replies. If LLM agent generation is unavailable, the service returns a clear temporary-unavailable message instead of static fallback content.

Do not set `GEMINI_API_KEY` for this mode. Docker mounts local ADC from `${APPDATA}/gcloud/application_default_credentials.json` to `/secrets/application_default_credentials.json` and sets `GOOGLE_APPLICATION_CREDENTIALS` inside the ai-service container.

To use Claude through Anthropic:

```env
LLM_PROVIDER=anthropic
LLM_API_KEY=your_anthropic_key_here
LLM_MODEL=claude-sonnet-4-5
LLM_SUPERVISOR_TEMPERATURE=0.1
LLM_AGENT_TEMPERATURE=0.7
LLM_MAX_OUTPUT_TOKENS=700
LLM_THINKING_BUDGET=0
LLM_AGENT_MAX_CHARS=900
ENABLE_LLM_SUPERVISOR=true
ENABLE_LLM_AGENT_RESPONSES=true
```

Optional Anthropic-specific overrides:

```env
ANTHROPIC_API_KEY=your_anthropic_key_here
ANTHROPIC_MODEL=claude-sonnet-4-5
```

You can switch between Gemini and Claude by changing only the provider/key/model values in `.env`, then rebuilding/restarting the containers.

Rebuild containers after changing dependencies or environment:

```bash
docker compose down
docker compose up --build
```

## Optional NestJS Internal API Sync

When `NEST_INTERNAL_BASE_URL`, `INTERNAL_SERVICE_CLIENT_ID`, and `INTERNAL_SERVICE_CLIENT_SECRET` are set, the AI service authenticates against the separate NestJS backend internal API.

The Python service only calls `/internal/v1/*` endpoints. It requests a service token from `/internal/v1/auth/token`, caches it in memory, refreshes it before expiry, and retries once after a `401`.

High and critical WhatsApp/care-seeker messages attempt to create a backend case at `/internal/v1/cases` with `phoneNumber`, `name`, `riskLevel`, `latestMessage`, `summary`, and `source`.

Run the helper scripts from `ai-service`:

```bash
python scripts/test_internal_auth.py
python scripts/test_message_flow.py
```
