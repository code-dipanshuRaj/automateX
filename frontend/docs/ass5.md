# Hosting Plan of Application Components

## Overview

This document describes the hosting strategy, deployment plan, and security
measures for the **AI-Based Task Execution System**.

The system consists of multiple components including a frontend,
backend orchestrator, NLU service, LLM integration, task workers,
databases, and external API integrations.

---

# I. Host Site — Target Server / Cloud Deployment

Below is the hosting plan for each component:

---

## 1. Frontend (Vite)

- **Platform:** Vercel 
- **Purpose:**
  - Chat interface
  - Confirmation UI
  - Admin dashboard
- **Access Method:** HTTPS via CDN
- **Reason:** Optimized for Next.js with automatic scaling and SSL

---

## 2. Backend Orchestrator (FastAPI)

- **Platform:** AWS EC2 / Render / DigitalOcean App Platform
- **Environment:** Ubuntu Server (Docker-based deployment)
- **Responsibilities:**
  - Receive user messages
  - Call NLU & LLM services
  - Validate structured plans
  - Enqueue tasks
  - Handle RBAC & logging

---

## 3. NLU Service (FastAPI – Python)

- **Platform:** EC2 / Same as Orchestrator 
- **Responsibilities:**
  - Intent classification
  - Slot extraction
  - Confidence scoring
- **Scaling:** Independently scalable container

---

## 4. LLM Component

- **Service:** Google Gemini API (gemini-2.5-flash)
- **Hosting:** Google Cloud (Managed API)
- **Responsibilities:**
  - Plan generation (structured JSON)
  - Conversational responses
- **Note:** No self-hosting required for MVP

---

## 5. Vector Database (RAG Component)

- **MVP:** Self-hosted Qdrant / Chroma on VM
- **Production:** Pinecone / Qdrant Cloud
- **Purpose:**
  - Store embeddings
  - Retrieve relevant document chunks

---

## 6. Task Queue & Workers

- **Queue:** Redis (Managed – Upstash / AWS ElastiCache)
- **Workers:** Hosted on same cloud provider as backend
- **Responsibilities:**
  - Execute external API tasks
  - Retry logic
  - Compensation handling

---

## 7. Databases
- **Backend:** MongoDB and Redis
- **Raw Logs:** MongoDB Atlas 
- **Analytics:** PostgreSQL
- **Object Storage:** AWS S3

---

# II. Deployment Strategy

Deployment is performed in the following steps:

---

## Step 1: Containerization

- Create Docker images for:
  - Orchestrator
  - NLU Service
  - Worker Service
  - RAG Indexer
  - Frontend
- Push images to:
  - GitHub Container Registry / Docker Hub

---

## Step 2: Infrastructure Provisioning

- Provision:
  - VM (EC2 / Render)
  - Managed MongoDB Atlas
  - Managed Redis
  - Managed PostgreSQL
- Configure DNS and domain mapping.

---

## Step 3: Server Configuration

- Install Docker & Docker Compose.
- Configure:
  - Non-root deployment user
  - SSH key-based authentication
  - Firewall (UFW)
- Open only required ports:
  - 80 (HTTP)
  - 443 (HTTPS)
  - 22 (Restricted SSH)

---

## Step 4: Environment & Secrets Management

- Store secrets in:
  - AWS Secrets Manager / GitHub Secrets
- Provide `.env.example` for local development.

Environment variables include:
- GOOGLE_API_KEY
- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- VECTOR_DB_URL

---

## Step 5: Service Wiring & API Routing

- Configure reverse proxy (NGINX / Cloud Load Balancer):
  - `/api/*` → Orchestrator
  - `/nlu/*` → NLU Service
- Enable HTTPS with TLS certificates.
- Enable CORS rules for frontend access.

---

## Step 6: Monitoring & Logging

- Enable:
  - Error tracking
  - Prometheus + Grafana (metrics)
  - MongoDB raw logs
- Configure automatic DB backups.

---

# III. Security Measures

Security is enforced at multiple levels:

---

## 1. HTTPS Encryption

- All communication via HTTPS.
- TLS certificates managed by hosting provider.

---

## 2. OAuth 2.0 Authentication

- Used for:
  - Gmail API
  - Google Calendar API
- Access tokens stored securely.
- No user passwords stored.

---

## 3. Role-Based Access Control (RBAC)

- Admin-only endpoints protected.
- Plan execution requires validation.
- Destructive actions require confirmation.

---

## 4. Secrets Management

- Secrets stored in cloud secret manager.
- No hardcoded credentials in source code.

---

## 5. Idempotency & Audit Logging

- Redis-based idempotency keys prevent duplicate execution.
- All actions logged in MongoDB.
- Immutable event logs for traceability.

---

## 6. Least Privilege Principle

- Minimal OAuth scopes:
  - `calendar.events`
  - `gmail.send`
- Limited IAM permissions for services.

---

# Deployment Architecture Diagram

# II. How end users access services — pictorial representation

    [User Browser]
        │
        ▼
    [Next.js Frontend]  <--(HTTPS/WebSocket)-->  [API Gateway / Orchestrator (FastAPI)]
                                                       │
                    ┌──────────────────────────────────┼────────────────────────────┐
                    │                                  │                            │
                    ▼                                  ▼                            ▼
                [NLU Service]                       [RAG Service]               [Task Queue -> Workers]
            (intent & slot extraction)            (retrieve docs & chunks)       (execute connectors)
                    │                                  │                            │
                    └─────────────┬────────────────────┴─────────────┬──────────────┘
                                  ▼                                  ▼
                              [Vector DB]                       [External APIs]
                                                           (Google Calendar, SMTP)


# III. Implementation of Application Components and Their Interactions

## 1. Intent Classification Module

### Objective

To classify user input into one of the following categories: - EMAIL -
CALENDAR - NEWS - CHAT

This module acts as the decision-making controller of the system.

### Implementation

``` python
intent_prompt = PromptTemplate.from_template("""
Classify the user's message into one word:

CHAT
EMAIL
CALENDAR
NEWS

Message: {input}

Answer:
""")

intent_chain = intent_prompt | model | StrOutputParser()

intent = intent_chain.invoke({"input": user_input}).strip().upper()
```

### Working Mechanism

1.  User enters natural language input.
2.  Input is passed to Gemini LLM.
3.  LLM classifies the message.
4.  Based on classification, appropriate tool is triggered.

### Routing Logic

``` python
if "EMAIL" in intent:
    reply = email_tool(user_input)
elif "CALENDAR" in intent:
    reply = calendar_tool(user_input)
elif "NEWS" in intent:
    reply = news_tool(user_input)
else:
    reply = normal_chat(user_input)
```

------------------------------------------------------------------------

## 2. Email Tool Implementation

### Objective

To automatically send emails using Gmail API.

### Step 1: Extract Email Details Using LLM

``` python
details_text = email_extract_chain.invoke({"input": user_input})
```

Example Output:

    to: example@gmail.com
    subject: Meeting Reminder
    body: Dear Sir, ...

### Step 2: Parse Extracted Details

``` python
data = parse_details(details_text)
to = data.get("to")
subject = data.get("subject")
body = data.get("body")
```

### Step 3: OAuth Authentication

``` python
flow = InstalledAppFlow.from_client_secrets_file(
    "credentials.json", SCOPES
)
creds = flow.run_local_server(port=0)
```

### Step 4: Send Email

``` python
message = MIMEText(body)
message["to"] = to
message["subject"] = subject

raw_message = base64.urlsafe_b64encode(
    message.as_bytes()
).decode()

gmail_service.users().messages().send(
    userId="me",
    body={"raw": raw_message}
).execute()
```

### Interaction Flow (Email)

User → Intent Classifier → Email Tool → Gmail API → Response

------------------------------------------------------------------------

## 3. Calendar Tool Implementation

### Objective

To schedule events in Google Calendar.

### Step 1: Extract Event Details

``` python
details_text = calendar_extract_chain.invoke({"input": user_input})
```

Extracted Format:

    title:
    date:
    time:
    duration_minutes:

### Step 2: Convert to ISO Datetime

``` python
start_dt = datetime.datetime.fromisoformat(f"{date}T{time}:00")
end_dt = start_dt + datetime.timedelta(minutes=int(duration))
```

### Step 3: Insert Event

``` python
calendar_service.events().insert(
    calendarId="primary",
    body=event
).execute()
```

### Interaction Flow (Calendar)

User → Intent Classifier → Calendar Tool → Google Calendar API →
Response

------------------------------------------------------------------------

## Overall Component Interaction

User Input\
→ Intent Classification (Gemini)\
→ Tool Routing\
→ Email Tool / Calendar Tool\
→ External APIs\
→ Response to User

------------------------------------------------------------------------

## Conclusion

The system implements multiple modular components that interact through
a centralized intent classification mechanism. The Email and Calendar
tools demonstrate real-world task execution using secure OAuth-based API
integrations. The interaction flow ensures scalability, modularity, and
secure automation of user tasks.