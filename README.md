# Intelligent Task Automation Platform  
**AI-powered Chatbot with Task Execution, RAG, and ETL Analytics**

---

## Overview

This project is an **Intelligent Automation Platform** that combines **AI-driven natural language understanding**, **task execution**, **Retrieval-Augmented Generation (RAG)**, and **ETL-based analytics** to build a **production-grade software system**.

The system allows users to interact via natural language (chat UI) to:
- Schedule meetings
- Send emails
- Manage tasks
- Query domain knowledge grounded in documents

Unlike a simple chatbot, this platform is designed with **software engineering rigor**:
- LLMs do **planning**, not execution
- Execution is handled by a **safe orchestrator**
- All actions are **observable, auditable, and measurable**

This project is intentionally scoped to demonstrate **AI integration for software engineering roles**, not research-only ML.

---

## High-Level Architecture
    User([User React UI]) --> Gateway[API Gateway / Load Balancer]
    Gateway --> Orchestrator[Orchestrator Service Node/Express]
        Orchestrator --> Redis[(Session Manager Redis)]
        Orchestrator --> NLU[NLU Service FastAPI]
        Orchestrator --> RAG[RAG Service + Vector DB]
        Orchestrator --> LLM[LLM local/hosted]
        Orchestrator --> Connectors[Connector Manager Calendar/Email/Todo]

    Orchestrator --> MongoDB[(Raw Logs MongoDB)]
    MongoDB --> ETL[ETL Pipeline]
    ETL --> Postgres[(Analytics Store Postgres/Mongo)]
    Postgres --> Dashboard[Dashboard Metabase/Grafana]
---

## Core Design Principles

- **LLMs do not execute tasks**  
  They only generate **structured plans** (JSON / function calls).

- **Execution is deterministic and safe**  
  Orchestrator validates, authorizes, retries, and audits every action.

- **RAG is used for grounding, not creativity**  
  Ensures factual responses from documents and policies.

- **ETL usage**  
  Enables monitoring, debugging, and continuous improvement.

---

## Complete Tech Stack

### Languages & Runtimes
- **Node.js** – Orchestrator, workers, connectors
- **Python** – NLU service, RAG ingestion, ETL jobs

---

### Frontend
- **React**
- **Vite**
- **Tailwind CSS**
- **React Query / SWR**

---

### API & Orchestration
- **Express.js**
- **Redis** (sessions, idempotency, caching)

---

### NLU (ML Layer 1)
- **FastAPI**
- **Hugging Face Transformers**
  - Intent Classification (DistilBERT / MiniLM)
  - Slot Extraction (Token Classification)
- **spaCy** (normalization & fallback)
- **PyTorch**

---

### RAG & Vector Search (ML Layer 2)
- **Sentence-Transformers** (embeddings)
- **Vector DB**
  - MVP: **Chroma** or **Qdrant  or **Pinecone / **Weaviate / **Qdrant Cloud (self-hosted)**
- **Optional reranker** (cross-encoder or LLM-based)

---

### LLM Planning (ML Layer 3)
- **OR Local LLMs** (Mistral / LLaMA variants)
- **Custom Planner Layer** (preferred over agent auto-execution)
- **LangChain** (tool orchestration only)

---

### Data Stores
- **MongoDB**
  - Raw logs
  - Audit trails
  - Application documents
- **PostgreSQL**
  - Curated analytics (ETL output)
- **MinIO (S3-compatible)**
  - Documents, backups, artifacts

---

### Task Connectors
- **Google Calendar API** (OAuth2)
- **SMTP / Gmail API** (email)
- **Internal ToDo Service** (Express + DB)

---

### ETL & Analytics
- **Python ETL jobs**
- **Prefect** or **Cron**
- **Pandas / DuckDB / SQL**
- **Metabase** or **Apache Superset**

---

### CI/CD & Deployment
- **Docker**
- **Docker Compose**
- **GitHub Actions**
- **GitHub Container Registry**
- **Deployment Targets**
  - MVP: Single VM / Render / DigitalOcean
  - Production: AWS ECS/EKS / GCP GKE

---

### Observability & Monitoring
- **Sentry** (errors)
- **Prometheus + Grafana** (metrics)
- **OpenTelemetry** (tracing)
- **Loki / ELK** (logs)

---

### Security
- **OAuth2** (external APIs)
- **RBAC** (role-based permissions)
- **Idempotency keys**
- **Audit logs**
- **Secrets via env / GitHub Secrets**

---

## Execution Flow (Simplified)

1. User sends message via UI
2. Orchestrator receives request
3. NLU service extracts intent & slots
4. (Optional) RAG retrieves grounded knowledge
5. LLM generates **structured plan**
6. Orchestrator validates & authorizes plan
7. Tasks are enqueued
8. Workers execute tasks safely
9. Results logged to MongoDB
10. ETL aggregates metrics
11. Dashboard visualizes system health

---

## Why RAG is Used

- Grounds responses in **real documents**
- Prevents hallucinations
- Allows instant knowledge updates
- Supports policy-aware automation

---

## Why ETL is Used

- Measure task success rate
- Monitor AI accuracy & drift
- Debug failures
- Enable retraining pipelines
- Prove business impact

ETL turns raw AI behavior into **engineering signals**.

---

## Metrics Tracked

- Intent accuracy
- Slot extraction F1
- Task success rate
- Mean & P95 latency
- Retrieval recall@K
- Error taxonomy
- Unknown intent rate
---
