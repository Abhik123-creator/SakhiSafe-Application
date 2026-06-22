# SakhiSafe AI Service Guide

## Purpose

This document is the reference guide for building the **SakhiSafe AI Service**. It is meant to be used by an agentic LLM coder while generating the project step by step.

SakhiSafe is a WhatsApp-first women-safety assistant. The user already has a working WhatsApp/messaging service where messages are coming in. This AI service will sit behind that messaging layer and will handle safety-focused AI reasoning, agent routing, tool execution, evidence storage, safety planning, and trusted-contact workflows.

The architecture should follow the existing chatbot style:

- Messaging service receives WhatsApp messages.
- Messaging service forwards normalized payload to AI service.
- AI service loads user profile and conversation history.
- Supervisor LLM decides which specialist agent should handle the message.
- Specialist agent uses tool calling.
- Python executes safe backend/database/API operations.
- LLM writes final human-facing response.
- AI service returns response to messaging service.
- Messaging service sends response back to WhatsApp.

The key principle is:

> The LLM decides intent, gathers missing information, selects tools, and writes the final response. Python provides trusted execution boundaries: validation, database persistence, encryption, API calls, logging, retries, and guardrails.

---

## High-Level System Architecture

```txt
WhatsApp User
    ↓
WhatsApp Provider / Webhook
    ↓
Messaging Service
    ↓
POST /ai/message to SakhiSafe AI Service
    ↓
AI Service Coordinator
    ↓
User Profile + Conversation History + Safety Context
    ↓
Supervisor Agent
    ↓
Specialist Agent
    ↓
Tool Calling Layer
    ↓
Backend APIs / Database / Notification Service / Evidence Vault
    ↓
Final AI Response
    ↓
Messaging Service
    ↓
WhatsApp User
```

---

## Service Boundary

### Messaging Service Responsibility

The messaging service should only handle messaging infrastructure.

It should:

- Receive WhatsApp webhook events.
- Verify webhook/provider signature if available.
- Normalize incoming messages.
- Extract sender phone, name, text, media, location, and message id.
- Call the AI service.
- Send AI response back to WhatsApp.
- Handle WhatsApp provider-specific retries and delivery issues.

It should not:

- Run LLM logic.
- Decide safety intent.
- Store sensitive evidence unless required temporarily.
- Contain crisis/safety business logic.

### AI Service Responsibility

The AI service should handle reasoning and safe actions.

It should:

- Receive normalized message payloads from the messaging service.
- Authenticate or create user profile by phone number.
- Load conversation history.
- Apply safety and privacy guardrails.
- Route to specialist agents.
- Execute tools safely.
- Store encrypted messages/incidents/evidence metadata.
- Return a safe response object to the messaging service.

---

## Recommended Tech Stack

### AI Service

- Python 3.11+
- FastAPI
- Uvicorn
- SQLAlchemy or SQLModel
- PostgreSQL for production
- SQLite for local development if needed
- Pydantic for schemas
- Redis for queues/rate limiting/session cache if needed later
- Celery/RQ/Arq for background jobs later
- LLM provider wrapper: OpenAI, Anthropic, Gemini, Groq, OpenRouter, or local model

### Security

- Fernet or AES-GCM field-level encryption for sensitive records
- bcrypt/argon2 for PIN hashes
- SHA-256 for file hashing
- Environment-based secrets
- Strict audit logging for tool actions

---

## Initial Folder Structure

```txt
sakhi-ai-service/
  README.md
  GUIDE.md
  .env.example
  requirements.txt
  main.py

  app/
    config.py

    core/
      llm.py
      security.py
      encryption.py
      safety.py
      logging.py

    agents/
      __init__.py
      coordinator.py
      supervisor.py
      base.py
      crisis_agent.py
      abuse_pattern_agent.py
      safety_planning_agent.py
      evidence_agent.py
      trusted_contact_agent.py
      stealth_agent.py
      legal_resource_agent.py
      api_ops_agent.py

    prompts/
      supervisor.txt
      crisis_agent.txt
      abuse_pattern_agent.txt
      safety_planning_agent.txt
      evidence_agent.txt
      trusted_contact_agent.txt
      stealth_agent.txt
      legal_resource_agent.txt
      api_ops_agent.txt

    tools/
      __init__.py
      user_tools.py
      evidence_tools.py
      trusted_contact_tools.py
      safety_plan_tools.py
      stealth_tools.py
      resource_tools.py
      emergency_tools.py
      notification_tools.py
      swagger_toolkit.py

    db/
      __init__.py
      session.py
      models.py
      repositories.py

    schemas/
      messaging.py
      agent.py
      tools.py
      users.py
      incidents.py
      safety_plan.py

    services/
      conversation_service.py
      user_service.py
      evidence_service.py
      notification_service.py
      resource_service.py
      audit_service.py
```

---

## API Contract Between Messaging Service and AI Service

### Endpoint

```txt
POST /ai/message
```

### Request Body

```json
{
  "source": "whatsapp",
  "sender": {
    "id": "919876543210",
    "phone": "919876543210",
    "name": "Optional User Name"
  },
  "message": {
    "id": "wamid.xxxxx",
    "type": "text",
    "text": "I need help",
    "timestamp": "2026-05-30T10:00:00+05:30",
    "media": null,
    "location": null
  },
  "metadata": {
    "provider": "whatsapp_cloud_api",
    "raw_event_id": "optional"
  }
}
```

### Response Body

```json
{
  "success": true,
  "reply": {
    "type": "text",
    "text": "I am here with you. Are you in immediate danger right now? Reply YES if you need urgent help.",
    "sensitive": true,
    "stealth_safe": false
  },
  "agent": "crisis_agent",
  "risk_level": "high",
  "actions": [
    {
      "type": "incident_created",
      "id": "inc_123"
    }
  ]
}
```

---

## Main Request Flow

```txt
1. Receive normalized message at POST /ai/message.
2. Validate payload with Pydantic.
3. Normalize sender phone number.
4. Load or create user profile.
5. Load existing conversation by thread id.
6. Save incoming message in encrypted form.
7. Load last N messages as context.
8. Build profile context:
   - stealth mode enabled?
   - trusted contacts configured?
   - language preference?
   - existing safety plan?
   - recent risk level?
9. Run supervisor agent.
10. Supervisor returns strict JSON:
    - selected agent
    - risk level
    - reason
    - optional direct response
11. If direct response exists, return it.
12. Otherwise run selected specialist agent.
13. Specialist agent may call tools.
14. Python executes tools with validation and audit logs.
15. Tool results go back to the LLM.
16. LLM produces final human-facing response.
17. Save assistant response.
18. Return response to messaging service.
```

---

## Core Agents

### 1. Supervisor Agent

The supervisor only routes. It should not perform complex actions.

Routes:

```txt
crisis_agent
- immediate danger
- active violence
- threats
- being trapped
- urgent panic
- user asks for emergency help

abuse_pattern_agent
- user asks whether something is abuse
- controlling behavior
- gaslighting
- stalking
- emotional abuse
- financial control
- digital abuse

safety_planning_agent
- user wants to leave safely
- user wants to prepare safety plan
- user asks how to protect herself
- user needs emergency bag/checklist

evidence_agent
- user wants to save incident
- user sends screenshot/photo/audio/video
- user wants to document abuse
- user wants export/report later

trusted_contact_agent
- add trusted contact
- alert trusted contact
- set code word
- check-in flow

stealth_agent
- hide chat
- activate stealth mode
- fake normal mode
- delete visible history
- PIN/vault access

legal_resource_agent
- legal rights
- complaint process
- helplines
- NGO/legal aid/shelter information

api_ops_agent
- fallback for backend operations not covered by fixed agents

none
- greeting
- small talk
- unsupported or unsafe request
```

Supervisor output must be JSON only:

```json
{
  "agent": "crisis_agent",
  "risk_level": "critical",
  "reason": "User says she is being threatened right now",
  "direct_response": null
}
```

---

### 2. Crisis Agent

Purpose: immediate safety support.

Responsibilities:

- Keep reply short.
- Prioritize immediate physical safety.
- Avoid long explanations.
- Ask if user is in immediate danger only when unclear.
- Suggest contacting local emergency services if immediate danger exists.
- Offer trusted contact alert if configured or with explicit consent.
- Do not encourage confrontation.
- Do not over-collect details during emergency.

Tools:

```txt
get_trusted_contacts
send_trusted_contact_alert
create_incident
get_emergency_resources
activate_stealth_mode
```

Example response:

```txt
Your safety comes first. If you can, move near an exit or to a place with other people. If you are in immediate danger, call local emergency services now. Do you want me to alert your trusted contact?
```

---

### 3. Abuse Pattern Agent

Purpose: help user understand abusive patterns.

Responsibilities:

- Identify possible abuse patterns gently.
- Avoid diagnosing or blaming.
- Validate the user's feelings.
- Offer next step: safety plan, evidence save, trusted contact, resource help.

Categories:

```txt
physical_abuse
emotional_abuse
financial_abuse
sexual_abuse
stalking
threats
coercive_control
digital_abuse
isolation
gaslighting
```

Tools:

```txt
classify_abuse_pattern
save_pattern_note
suggest_next_steps
```

---

### 4. Safety Planning Agent

Purpose: create practical plans.

Plan types:

```txt
stay_safe_at_home
prepare_to_leave
emergency_escape
digital_safety
financial_preparation
children_or_dependents
workplace_safety
post_separation_safety
```

Tools:

```txt
create_safety_plan
update_safety_plan
get_safety_checklist
get_safe_contacts
get_nearby_resources
```

---

### 5. Evidence Agent

Purpose: securely document incidents.

Responsibilities:

- Save what the user provides.
- Ask optional follow-up details but do not pressure.
- Categorize incident.
- Attach media if present.
- Store files securely.
- Generate summaries and reports only through tools.
- Never claim evidence guarantees legal success.

Tools:

```txt
create_incident
attach_evidence_file
list_incidents
export_evidence_pdf
delete_evidence
generate_evidence_summary
```

---

### 6. Trusted Contact Agent

Purpose: trusted-contact workflows.

Responsibilities:

- Add contact.
- Verify contact.
- Set code word.
- Send alert only with explicit user consent or configured code word.
- Send neutral/safe message if configured.

Tools:

```txt
add_trusted_contact
verify_trusted_contact
get_trusted_contacts
send_alert
send_checkin
send_location
set_code_word
```

---

### 7. Stealth Agent

Purpose: privacy protection.

Responsibilities:

- Activate stealth mode.
- Switch to harmless replies.
- Hide sensitive context.
- Set PIN for vault.
- Support code words.
- Delete visible local conversation if supported.

Tools:

```txt
activate_stealth_mode
deactivate_stealth_mode
set_stealth_pin
verify_stealth_pin
set_cover_topic
set_code_word
delete_visible_history
```

Example cover mode response:

```txt
Okay, weather updates are now enabled.
```

Meaning internally:

```txt
Stealth mode activated.
```

---

### 8. Legal Resource Agent

Purpose: general legal/resource guidance.

Responsibilities:

- Give general information only.
- Do not act as a lawyer.
- Do not guarantee outcomes.
- Fetch verified resources through tools.
- Prefer official/verified sources in resource database.

Tools:

```txt
get_verified_legal_resources
get_helplines
get_local_ngos
get_shelters
get_cybercrime_resources
```

---

## Base Agent Tool-Calling Loop

Every specialist agent should use the same reusable loop.

```txt
1. Render system prompt.
2. Add user profile context.
3. Add recent conversation history.
4. Add available tools.
5. Call LLM.
6. If LLM returns final text, finish.
7. If LLM requests tool call:
   - validate tool name
   - validate arguments
   - execute Python function
   - save audit log
   - return tool result to LLM
8. Continue until final response or max turns.
9. Stop at max turns with safe fallback message.
```

Hard limits:

```txt
MAX_TOOL_TURNS = 5
MAX_HISTORY_MESSAGES = 10
MAX_RESPONSE_LENGTH_CRISIS = short
MAX_RESPONSE_LENGTH_NORMAL = medium
```

---

## Tool Design Rules

The LLM must never directly mutate the database. It can only request tools.

Every tool must have:

```txt
name
description
input_schema
permission_level
risk_level
python_handler
audit_log_required
```

Example tool:

```json
{
  "name": "create_incident",
  "description": "Create an encrypted incident record for the current user.",
  "input_schema": {
    "type": "object",
    "properties": {
      "incident_type": {
        "type": "string",
        "enum": ["physical", "emotional", "financial", "sexual", "stalking", "digital", "threat", "other"]
      },
      "description": {
        "type": "string"
      },
      "severity": {
        "type": "string",
        "enum": ["low", "medium", "high", "critical"]
      },
      "incident_datetime": {
        "type": "string"
      },
      "location": {
        "type": "string"
      }
    },
    "required": ["incident_type", "description", "severity"]
  }
}
```

---

## Database Models

### users

```txt
id
phone
display_name
language
stealth_mode_enabled
created_at
updated_at
```

### conversations

```txt
id
user_id
thread_id
source
created_at
updated_at
```

### messages

```txt
id
conversation_id
role
encrypted_content
message_type
agent_name
risk_level
provider_message_id
created_at
```

### incidents

```txt
id
user_id
incident_type
severity
risk_level
encrypted_description
incident_datetime
location_encrypted
created_at
updated_at
```

### evidence_files

```txt
id
incident_id
file_type
encrypted_file_url
file_hash
original_filename
created_at
```

### safety_plans

```txt
id
user_id
plan_type
encrypted_plan
risk_level
created_at
updated_at
```

### trusted_contacts

```txt
id
user_id
name
phone
relationship
priority
verified
created_at
updated_at
```

### stealth_settings

```txt
id
user_id
stealth_enabled
cover_topic
pin_hash
code_word_hash
created_at
updated_at
```

### alerts

```txt
id
user_id
trusted_contact_id
alert_type
status
message_sent
created_at
sent_at
```

### audit_logs

```txt
id
user_id
action
agent_name
tool_name
metadata_json
created_at
```

---

## Safety and Privacy Rules

### Always do

```txt
Use calm, trauma-informed language.
Prioritize immediate safety in crisis.
Ask consent before sending alerts.
Keep crisis replies short.
Encrypt sensitive data.
Audit every tool action.
Use verified resource data only.
Respect stealth mode.
Make it easy to exit or hide.
```

### Never do

```txt
Do not blame the user.
Do not force police/legal action.
Do not tell user to confront abuser.
Do not guarantee safety.
Do not guarantee legal outcomes.
Do not invent helplines, NGOs, shelters, laws, or contacts.
Do not expose sensitive content in notifications.
Do not send trusted-contact alerts without consent unless a preconfigured code word was triggered.
Do not store unencrypted sensitive content.
```

---

## Risk Levels

```txt
low
- general question
- education
- non-urgent planning

medium
- concerning abuse indicators
- emotional distress
- non-immediate threats

high
- recent violence
- serious threats
- stalking
- user afraid to go home

critical
- immediate physical danger
- active assault
- trapped
- weapon threat
- suicidal/self-harm statements
- urgent emergency request
```

---

## Stealth Mode Rules

When stealth mode is active:

```txt
1. Do not mention abuse, violence, safety plan, police, evidence, or emergency unless user unlocks vault/PIN mode.
2. Use cover topic responses.
3. Keep replies neutral.
4. Store real meaning internally if code word is detected.
5. Do not reveal that stealth mode is active.
```

Example:

```txt
User: weather mode
Internal action: activate_stealth_mode
Visible reply: Okay, weather updates are now enabled.
```

---

## MVP Build Order

### Phase 1: AI Service Skeleton

Build:

```txt
FastAPI app
/health endpoint
/ai/message endpoint
Pydantic request/response schemas
basic logging
.env config
```

### Phase 2: User and Conversation Persistence

Build:

```txt
users table
conversations table
messages table
phone normalization
load/create user
save incoming/outgoing message
load last 10 messages
```

### Phase 3: LLM Core

Build:

```txt
LLM client wrapper
model provider abstraction
retry handling
JSON response parser
safe fallback response
```

### Phase 4: Supervisor Agent

Build:

```txt
supervisor prompt
strict JSON route output
agent selection enum
risk level enum
reason logging
```

### Phase 5: Base Agent

Build:

```txt
common agent class
prompt renderer
tool loop
tool validation
max turns
tool result injection
```

### Phase 6: First Specialist Agents

Build in this order:

```txt
1. crisis_agent
2. abuse_pattern_agent
3. safety_planning_agent
4. evidence_agent
5. trusted_contact_agent
6. stealth_agent
```

### Phase 7: First Tools

Build:

```txt
create_incident
list_incidents
create_safety_plan
add_trusted_contact
get_trusted_contacts
send_trusted_contact_alert
activate_stealth_mode
deactivate_stealth_mode
```

### Phase 8: Encryption and Audit

Build:

```txt
encrypt message content
encrypt incident descriptions
encrypt safety plans
audit tool calls
audit alerts
audit evidence actions
```

### Phase 9: Media and Evidence

Build:

```txt
receive media metadata from messaging service
fetch media from provider if needed
store file securely
create file hash
attach file to incident
```

### Phase 10: Resource/Legal Layer

Build:

```txt
verified helpline database
NGO resource table
legal resource table
resource search tool
legal_resource_agent
```

---

## Coding Rules For Agentic LLM

When generating code for this project, follow these rules:

```txt
1. Do not put all logic in main.py.
2. Keep agents, tools, schemas, services, and DB separate.
3. Use Pydantic for all external request/response models.
4. Use SQLAlchemy/SQLModel models for database persistence.
5. Use async FastAPI endpoints where practical.
6. Never let the LLM directly access database sessions.
7. Tools are Python functions/classes with validated input.
8. Every sensitive tool call must create an audit log.
9. Never hardcode fake helplines as production truth.
10. Never invent IDs or resources.
11. Build one phase at a time.
12. Keep prompts in app/prompts/*.txt, not inside Python strings.
13. Keep all secrets in environment variables.
14. Add tests for routing, tools, and safety guardrails.
15. Add safe fallback responses for LLM/API failure.
```

---

## Environment Variables

```env
APP_NAME=SakhiSafe AI Service
APP_ENV=local
APP_DEBUG=true

AI_PROVIDER=openai
AI_MODEL=gpt-4.1-mini
AI_API_KEY=replace_me

DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/sakhisafe

ENCRYPTION_KEY=replace_with_fernet_key
PIN_PEPPER=replace_with_secret

MESSAGING_SERVICE_SECRET=replace_me
ALLOWED_MESSAGING_SERVICE_IPS=

MAX_HISTORY_MESSAGES=10
MAX_TOOL_TURNS=5
```

---

## First Endpoint To Build

```python
POST /ai/message
```

Input:

```python
AIMessageRequest
```

Output:

```python
AIMessageResponse
```

Initial behavior:

```txt
1. Receive message.
2. Create/load user.
3. Save message.
4. Run supervisor.
5. Return dummy response from selected agent.
```

Do not build all tools at once. First make routing work.

---

## First Test Messages

Use these messages to test routing:

```txt
"hi"
Expected: none/direct response

"he hit me today"
Expected: crisis_agent or evidence_agent, risk high

"is it abuse if he checks my phone every day?"
Expected: abuse_pattern_agent, risk medium

"i want to leave safely"
Expected: safety_planning_agent, risk high/medium

"save this incident"
Expected: evidence_agent

"alert my sister"
Expected: trusted_contact_agent

"turn on stealth mode"
Expected: stealth_agent

"what are my rights?"
Expected: legal_resource_agent
```

---

## Final Goal

The final SakhiSafe AI Service should become:

```txt
A secure, WhatsApp-first, multi-agent AI service for women’s safety that uses LLMs for natural-language understanding and support, while Python safely handles tool execution, evidence storage, trusted-contact workflows, resource lookup, encryption, audit logging, and backend integration.
```

