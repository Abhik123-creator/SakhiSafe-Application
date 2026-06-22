# 🚀 WhatsApp FastAPI Service (uv & Docker Stack)

A modern, high-performance, and extremely sleek FastAPI service skeleton tailored for mock WhatsApp webhook integrations, packaged using the lightning-fast Python package manager **Astral `uv`** and fully containerized with **Docker** and **Docker Compose**.

No database required. Simple, responsive, and robust structure ready for local development or production deploy.

---

## 🎨 Interactive Control Panel
This service features a built-in, responsive, glassmorphic dark-mode **Dashboard Control Panel** at the root path (`http://localhost:8000/`) styled with pure Vanilla CSS. 
* **Live API Test Dispatcher:** Dispatch test messages directly from your browser via AJAX to the FastAPI backend and inspect simulated real-time response bodies.
* **Meta Webhook Simulator:** Built-in routes mimicking official Meta developer webhooks for verification and event consumption.
* **Auto-refreshing Diagnostics:** Live service uptime tracking, active variables display, and hotlinks to documentation portals.

---

## 📂 Project Structure

```text
whatsapp/
├── app/
│   ├── __init__.py      # Package indicator
│   ├── config.py        # Configuration manager validated by Pydantic
│   └── main.py          # FastAPI application router, endpoints & dashboard UI
├── .dockerignore        # Optimizes Docker build contexts
├── .gitignore           # Ignores local caches, envs, & build artefacts
├── Dockerfile           # Optimized multi-stage Docker build utilizing uv
├── docker-compose.yml   # Dev orchestration (hot-reload, environment, healthchecks)
├── pyproject.toml       # Modern python package definitions
└── README.md            # Interactive guide (this file)
```

---

## 🛠️ Fast-track Launch

### Prerequisite
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 1. Fire up the Stack
To build the image and spin up the container in hot-reload mode:

```bash
docker compose up --build
```

The server launches instantly and will bind to **`http://localhost:8000`**.

### 2. Verify Services

* **Interactive Control Panel:** Open [http://localhost:8000](http://localhost:8000) in your web browser.
* **Auto-Generated Swagger Docs:** Open [http://localhost:8000/docs](http://localhost:8000/docs).
* **Alternative ReDoc Portal:** Open [http://localhost:8000/redoc](http://localhost:8000/redoc).
* **JSON Uptime Diagnostics:** View [http://localhost:8000/health](http://localhost:8000/health).

---

## ⚡ Developer Integrations

### A. Meta Webhook Verification
To simulate registering this webhook inside the Meta Developer Console:
* **Webhook URL:** `http://localhost:8000/webhook`
* **Verify Token:** `ariv_whatsapp_verify_token_secure_xyz`

To test verification via standard terminal curl:
```bash
curl -X GET "http://localhost:8000/webhook?hub.mode=subscribe&hub.challenge=SUCCESS_CONFIRMED&hub.verify_token=ariv_whatsapp_verify_token_secure_xyz"
```
**Response:** `SUCCESS_CONFIRMED`

### B. Sending a Simulated Message
Submit a mock message body to test integrations.

```bash
curl -X POST "http://localhost:8000/api/v1/messages/send" \
     -H "Content-Type: application/json" \
     -d '{
       "recipient": "+14155552671",
       "message": "Greetings from the shell!",
       "message_type": "text"
     }'
```

**Response Package:**
```json
{
    "success": true,
    "message_id": "wamid.HBgL+141...A288CE4D2FB74C91",
    "recipient": "+14155552671",
    "status": "simulated_success",
    "timestamp": "2026-05-17T14:02:15.918Z"
}
```

---

## ⚡ Docker Customizations

The Docker integration has been optimized with two professional mechanisms:
1. **Multi-Stage builds with `uv`:** The builder container utilizes Astral's official `uv` image, syncing packages using modern build-cache mounts to completely avoid redownloading packages when tweaking requirements.
2. **Python-Native Healthcheck:** The healthcheck runs directly inside Python's core `urllib` library, preventing check crashes due to the lack of utility packages (like `curl` or `wget`) inside slim Linux base environments.
