# SakhiSafe — Backend Architecture Guide

## High-level architecture

```mermaid
flowchart LR
  subgraph External
    WA[Meta WhatsApp Cloud API]
    Tools[External Tools & Helplines APIs]
    LLM[LLM Provider (abstracted)]
    ObjStore[Secure Object Store (S3-like)]
  end

  subgraph Compose_Net
    MS[messaging-service<br/>FastAPI :8000]
    AI[ai-service<br/>FastAPI :8080]
    PG[postgres: PostgreSQL 16]
    Vols[Volume: prompts, tools, migrations]
  end

  WA -->|Webhook (POST)| MS
  MS -->|Verify signature & challenge| MS
  MS -->|Normalize message, download media (if any)| MS
  MS -->|POST /messaging (normalized)| AI
  AI -->|Store/Read session & logs| PG
  AI -->|Read prompt files| Vols
  AI -->|Tool calls (e.g., helpline lookup, evidence upload)| Tools
  AI -->|Upload encrypted media or evidence metadata| ObjStore
  AI -->|Send reply payload| MS
  MS -->|Send message via WhatsApp Cloud API| WA

  PG --- Vols
  LLM --- AI
```

---

## Service responsibilities

**messaging-service**
- Public webhook endpoint on `:8000` for Meta WhatsApp Cloud API.
- Verify webhook challenge and `X-Hub-Signature-256` for every POST.
- Parse & normalize WhatsApp messages into internal schema.
- Download media transiently, run basic validation/scan, optionally upload encrypted media to object store and replace with pointer.
- Forward normalized payloads to `ai-service` (HTTP POST to `/messaging`).
- Send AI-generated replies back to WhatsApp Cloud API.
- Log only minimal delivery/audit events (redacted).

**ai-service**
- Internal API on `:8080` exposing `/messaging` for normalized messages.
- Agent-based pipeline: safety assessment, crisis response, evidence logging, helpline/resource lookup, emotional support.
- LLM abstraction (pluggable providers) and externalized prompt files (mounted volume).
- Tools framework: controlled adapters for helplines, evidence upload, notifications, SMS/APIs.
- Persist sessions, assessments, evidence metadata, and audit logs in Postgres.
- Enforce privacy (redaction, minimization) and return structured replies + recommended actions.

**postgres (PostgreSQL 16)**
- Single DB used only by `ai-service`.
- Persistent `pgdata` volume.
- Healthcheck and internal network binding only.

---

## Request flow (step-by-step)

1. User sends WhatsApp message → Meta WhatsApp Cloud API.
2. WhatsApp Cloud POSTs webhook to `messaging-service`.
3. `messaging-service` validates challenge and `X-Hub-Signature-256`.
4. On success, normalize message to internal schema.
5. If media exists: download temporarily, scan, encrypt and upload to `ObjStore`, replace payload with secure pointer.
6. `messaging-service` POSTs normalized payload to `ai-service` `/messaging`.
7. `ai-service` loads prompts, looks up/creates session in Postgres and runs agent pipeline:
   - Safety triage (immediate risk detection)
   - Decide actions (reply generation, helpline lookup, evidence capture, escalate)
   - Use LLM via abstraction and tools for external APIs
8. `ai-service` persists message/assessment/evidence metadata and audit logs in Postgres.
9. `ai-service` returns structured reply(s) to `messaging-service`.
10. `messaging-service` formats and sends replies via WhatsApp Cloud API.
11. Delivery events logged (redacted); evidence stored encrypted with strict access controls and retention.

---

## Database responsibilities

- Store conversation sessions: session id, pseudo-participant id, timestamps, state, consent flags.
- Store normalized message metadata: direction, type, timestamps, redacted text, encrypted pointer to media.
- Store safety assessments: triage results, risk scores, immutable recommended actions.
- Store evidence metadata: encrypted pointers to object store, checksums, upload timestamps, access logs.
- Maintain helpline/resource caches with TTL.
- Maintain audit logs for assessments, escalations, operator actions (redacted).
- Enforce TLS, column/encryption for PII, and encrypted backups. Use application-level encryption for highest-risk fields.

---

## Security & privacy considerations

- Webhook & Transport
  - TLS for all inbound/outbound traffic.
  - Validate `X-Hub-Signature-256` and reject mismatches.
  - IP allowlist for webhook endpoint where feasible.

- Secrets & Config
  - Use Docker secrets or external secret manager; never commit secrets.

- Data Minimization & Redaction
  - Normalize and redact PII by default; store raw data only with explicit consent and audit trail.

- Encryption & Key Management
  - TLS in transit and encryption at rest; use KMS for keys and rotate regularly.

- Access Control & Isolation
  - `ai-service` internal-only; only `messaging-service` is public.
  - RBAC for operator/admin access.

- Audit & Monitoring
  - Immutable audit logs for triage/escalation; alerts for high-risk events.

- Evidence Handling
  - Store media in secure object store with access logs and short-lived tokens; support export/deletion for compliance.

- LLM & Third-party Risks
  - Avoid sending raw PII to LLMs; redact or pseudonymize data when possible.
  - Track provenance and confidence metadata for LLM outputs.

- Retention & Disaster Recovery
  - Define retention policies; encrypted backups and secure key management.

---

## What each service should NOT do

**messaging-service should NOT:**
- Run LLMs or perform complex AI assessment.
- Store long-term PII or media blobs locally.
- Expose admin/internal endpoints publicly.
- Bypass signature verification or retry semantics.

**ai-service should NOT:**
- Be publicly exposed to the Internet.
- Send messages directly to WhatsApp API (must use `messaging-service`).
- Store unencrypted raw media in Postgres.
- Log raw PII to general observability systems.
- Hardcode prompts (prompts must be externalized and versioned).

**postgres should NOT:**
- Be exposed publicly or bound to host network.
- Act as object store for media blobs.
- Hold unencrypted evidence or external API secrets.

---

## Docker Compose & operational notes (summary)

- Network: internal compose network; `messaging-service` publishes host port `8000`.
- Volumes:
  - `pgdata` for Postgres persistent data.
  - `prompts` mounted read-only to `ai-service` for prompt files.
  - `evidence-temp` for transient downloads with TTL cleanup.
- Healthchecks:
  - `messaging-service`: readiness includes webhook signature config.
  - `ai-service`: readiness requires DB connectivity and prompt files.
  - `postgres`: use `pg_isready` healthcheck.
- Secrets: use Docker secrets or external secret manager (do not store in repo).
- Logging: structured JSON with redaction; route to secure log sink.

---

## Next steps (suggested)

- Generate `docker-compose.yml` skeleton with placeholders for secrets.
- Draft DB DDL for sessions, messages, assessments, and evidence metadata.
- Create prompt file layout and tools adapter interfaces.

---

*Saved as `ARCHITECTURE.md` for future reference.*
