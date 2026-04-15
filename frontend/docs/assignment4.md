# Assignment — Software Architecture

**Project:** Intelligent Task Automation Platform

---

## I. Chosen Architecture Style: **Microservices Architecture + Layered**

The system is designed as a **Microservices** architecture with a central **Orchestrator** (API Gateway + coordinator). Multiple small, independently deployable services communicate over HTTP/APIs and share minimal state (session in Redis, logs in MongoDB).

---

### A. Justification: How the Software Falls in This Category (Component Granularity)

- **Granularity:** Each deployable unit is a **separate process** with a **single, well-defined responsibility** and its own runtime/stack:
  - **Frontend** — Single React SPA; presentation only; talks to Orchestrator via REST.
  - **Orchestrator** — Single Node/Express service; API gateway, auth, session, workflow coordination (NLU → RAG → Planner → Task Execution); does not implement NLU/RAG logic itself.
  - **NLU Service** — Separate FastAPI (Python) process; only intent + entity extraction; exposed as an HTTP API.
  - **RAG Service** — Separate Python process + Vector DB; only retrieval/augmentation; exposed as an HTTP API.
  - **Connectors** — Implemented inside the Orchestrator process (Calendar, Email, Todo); can be split into separate services later without changing the overall style.
- **Communication:** Services interact via **synchronous HTTP/API calls** (Orchestrator → NLU, RAG, LLM). No shared in-process memory; only shared data stores are Redis (session) and MongoDB (logs), used by the Orchestrator.
- **Deployment:** Frontend, Orchestrator, NLU, and RAG can be **deployed and scaled independently** (e.g. multiple NLU or RAG instances behind a load balancer).

**Diagram — Component granularity and communication:**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           MICROSERVICES BOUNDARIES                           │
├─────────────────┬──────────────────┬─────────────────┬───────────────────────┤
│   Frontend      │   Orchestrator   │   NLU Service   │   RAG Service         │
│   (React SPA)   │   (Node/Express) │   (FastAPI)     │   (Python + Vector)   │
├─────────────────┼──────────────────┼─────────────────┼───────────────────────┤
│ • UI            │ • API Gateway    │ • /parse        │ • /query              │
│ • Auth flows    │ • Auth middleware│ • Intent        │ • Retrieval           │
│ • Chat / Plan   │ • Session (Redis)│ • Entities      │ • Vector DB           │
│                 │ • Call NLU/RAG   │                 │                       │
│                 │ • Planner/LLM    │                 │                       │
│                 │ • Task Exec      │                 │                       │
│                 │ • Connectors     │                 │                       │
│                 │ • Logs (MongoDB) │                 │                       │
└────────┬────────┴─────────┬────────┴──────────┬──────┴────────────┬──────────┘
         │                  │                   │                   │
         │    HTTP/REST     │     HTTP          │      HTTP         │
         └──────────────────┴───────────────────┴───────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
                 Redis           MongoDB         LLM 
               (session)         (data)       (optional)
```

---

### B. Why This Architecture Is the Best Choice

- **Scalability**
  - **NLU** and **RAG** can be scaled independently (e.g. more replicas under load) without scaling the Orchestrator or Frontend.
  - Orchestrator can be scaled horizontally behind a load balancer; Redis/MongoDB can be scaled per product needs.
- **Maintainability**
  - Clear **bounded contexts**: NLU team can change models/frameworks without touching RAG or Orchestrator; same for RAG and connectors.
  - **Small codebases per service** (frontend, orchestrator, nlu, rag) reduce cognitive load and ease onboarding.
- **Performance**
  - **Right tool per job:** Python/FastAPI for NLU/RAG (ML/data stacks); Node for Orchestrator (I/O-bound, many external calls). No single monolith bottleneck.
  - **Caching and isolation:** Session in Redis keeps auth/session off the main DB; heavy RAG/NLU work stays in their own processes.
- **Other requirements**
  - **Technology diversity:** Microservices allow different languages (TypeScript, Python) and runtimes (Node, FastAPI, Vector DB) in one system.
  - **Evolvability:** New connectors or AI services can be added as new endpoints or new microservices without rewriting existing ones.
  - **Fault isolation:** A failure in NLU or RAG can be contained (timeouts, fallbacks) without bringing down the whole application.

**Trade-off acknowledged:** Operational complexity (more services to deploy and monitor) is accepted in return for scalability, maintainability, and the ability to use the best stack per component.

---

## II. Application Components (Present in the Project)

| # | Component | Responsibility | Technology |
|---|-----------|----------------|------------|
| 1 | **Frontend** | User interface: login/register, landing, dashboard, chat, plan approval, sessions list | React, TypeScript, Vite |
| 2 | **API Gateway / Orchestrator** | Single entry for API; routing, auth middleware, request/response handling | Node.js, Express (inside Orchestrator) |
| 3 | **Orchestrator Service** | Coordinates workflow: call NLU → RAG → Planner (LLM) → Task Execution; manages session and connectors | Node.js, Express |
| 4 | **Session Manager** | Store and retrieve user session state (e.g. conversation context) | Redis |
| 5 | **NLU Service** | Parse natural language; output intent and entities (e.g. `schedule_meeting`, `date: tomorrow`) | FastAPI (Python) |
| 6 | **RAG Service** | Query domain knowledge; retrieve relevant context for planning/execution | Python, Vector DB |
| 7 | **Planner / LLM** | Generate step-by-step plan from NLU output + RAG context | LLM (hosted API or local, e.g. Ollama) |
| 8 | **Connector Manager** | Execute approved actions: calendar, email, todo | Node (inside Orchestrator); adapters for GCal, Gmail/SMTP, Todo |
| 9 | **Raw Logs Store** | Persist request/execution logs for auditing and debugging | MongoDB |

**Diagram — Application components and data flow:**

```
                    ┌──────────────┐
                    │   User       │
                    └──────┬───────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. Frontend (React)                                                      │
│    • Landing, Login, Register, Dashboard, Chat, Sessions                 │
└──────┬───────────────────────────────────────────────────────────────────┘
       │ HTTP
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. API Gateway / 3. Orchestrator Service (Node/Express)                  │
│    • Auth, route requests, coordinate NLU → RAG → Planner → Task Exec    │
└──┬───────┬───────────┬────────────┬─────────────┬────────────────────────┘
   │       │           │            │             │
   ▼       ▼           ▼            ▼             ▼
┌─────┐ ┌─────┐   ┌─────────┐  ┌─────────┐  ┌──────────────┐
│ 4.  │ │ 9.  │   │ 5. NLU  │  │ 6. RAG  │  │ 7. Planner   │
│Redis│ │Mongo│   │Service  │  │ Service │  │ / LLM        │
│     │ │ DB  │   │(FastAPI)│  │(Python) │  │(external)    │
└─────┘ └─────┘   └─────────┘  └─────────┘  └──────────────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │ 8. Connector │
                                        │ Manager      │
                                        │ Calendar /   │
                                        │ Email / Todo │
                                        └──────────────┘
```

---

## Summary

- **Architecture style:** Microservices (with central Orchestrator).
- **Granularity:** Frontend, Orchestrator, NLU, RAG (and Connectors within Orchestrator) are separate deployable units with single responsibilities and HTTP boundaries.
- **Rationale:** Best fit for scalability, maintainability, performance, and technology diversity for this AI task-automation project.
- **Application components:** Nine components listed above (Frontend, Gateway, Orchestrator, Session/Redis, NLU, RAG, Planner/LLM, Connector Manager, Logs/MongoDB).
