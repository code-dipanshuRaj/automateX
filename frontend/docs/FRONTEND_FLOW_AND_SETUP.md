# Frontend — Flow & Setup

This document describes the frontend flow, structure, and everything implemented for the **Intelligent Task Automation Platform** React app.

---

## 1. Overview

- **Stack:** React 18, TypeScript, Vite, React Router 6.
- **Purpose:** User login/register, main dashboard with a **chat interface** for natural-language task queries, plan approval/rejection, and a sessions list. The UI assumes a backend (orchestrator) that will implement auth, chat, and plan APIs.

---

## 2. User Flows

### 2.1 Auth Flow

1. **Unauthenticated user**
   - Visiting `/` or `/dashboard` redirects to **`/login`**.
   - From login, they can go to **`/register`** via “Register” link.

2. **Login** (`/login`)
   - User enters **email** and **password**.
   - On submit → `authApi.login({ email, password })`.
   - On success: backend returns `{ user, token? }`; we store `token` and `user` in `localStorage`, then redirect to **`/dashboard`**.
   - On error: error message shown above the form.

3. **Register** (`/register`)
   - User enters **email**, optional **display name**, and **password**.
   - On submit → `authApi.register({ email, password, displayName? })`.
   - On success: same as login (store token/user, redirect to `/dashboard`).
   - On error: error message shown above the form.

4. **App load (already logged in)**
   - If `localStorage` has a token, we call **`authApi.me()`** to validate and refresh user.
   - If `me()` fails (e.g. 401), we clear token/user and treat as logged out.

5. **Logout**
   - Header “Sign out” or any future logout action → `authApi.logout()` (optional on backend), then we clear `localStorage` and set user to `null`.
   - On **401** from any API call, we clear token/user and dispatch `auth:logout` so the app can redirect to login.

### 2.2 Dashboard & Chat Flow

1. **Dashboard** (`/dashboard`)
   - Layout: **Header** (app name, user name, Sign out) + **Sidebar** (Chat, Sessions) + **main content**.
   - Default main content is the **Chat** view.

2. **Chat**
   - **Empty state:** Short hint: “Describe what you want to do” with example phrases (e.g. schedule meeting, send email).
   - **User sends a message:** User types in the input and submits (Enter or Send).
   - **Send flow:**
     - We optimistically add a **user** message to the list.
     - Call **`chatApi.sendMessage({ text, sessionId? })`**.
     - Backend returns `{ message, plan?, sessionId }`.
     - We append the **assistant** message; if a **plan** is present with status `pending`, we show a **Plan card** below that message with steps and **Approve** / **Reject** buttons.
   - **Plan approval:** User clicks Approve → **`planApi.approve(planId)`**; we update the plan status in state to `approved`. Reject → **`planApi.reject(planId)`**; we update to `rejected`.
   - **Session:** The first successful `sendMessage` response gives us a `sessionId`; we keep it in Dashboard state and pass it in subsequent `sendMessage` calls so the backend can tie messages to a session. When the user has a session, we could later load history via **`chatApi.getHistory(sessionId)`** (currently history load is triggered when `sessionId` is set).

3. **Sessions** (`/dashboard/sessions`)
   - Lists all sessions for the current user.
   - On load we call **`chatApi.getSessions()`** and render `sessions` (id, lastActivityAt, messageCount if provided).

---

## 3. Directory Structure

```
frontend/
├── docs/
│   └── FRONTEND_FLOW_AND_SETUP.md   # This file
├── public/
│   └── favicon.svg
├── src/
│   ├── api/
│   │   └── client.ts                # API client (auth, chat, plan)
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatInput.tsx         # Text input + Send
│   │   │   ├── ChatPanel.tsx        # Message list + input, send/history/plan logic
│   │   │   ├── MessageList.tsx      # Renders messages + PlanCard when plan pending
│   │   │   ├── MessageBubble.tsx    # Single message (user vs assistant)
│   │   │   └── PlanCard.tsx         # Plan steps + Approve/Reject
│   │   └── Layout/
│   │       ├── Header.tsx           # App name, user, Sign out
│   │       ├── Layout.tsx          # Shell: header + sidebar + <Outlet />
│   │       └── Sidebar.tsx         # Nav: Chat, Sessions
│   ├── context/
│   │   └── AuthContext.tsx         # user, login, register, logout, loading, error
│   ├── pages/
│   │   ├── Login.tsx               # Login form
│   │   ├── Register.tsx            # Register form
│   │   ├── Dashboard.tsx           # Wraps ChatPanel (session state)
│   │   ├── Sessions.tsx            # Sessions list
│   │   ├── Auth.module.css
│   │   ├── Dashboard.module.css
│   │   └── Sessions.module.css
│   ├── types/
│   │   └── index.ts                # User, ChatMessage, PlanPayload, SessionInfo, etc.
│   ├── App.tsx                     # Routes + Protected/Public wrappers
│   ├── main.tsx                    # React root + BrowserRouter
│   ├── index.css                   # Global CSS variables + base styles
│   └── vite-env.d.ts               # Vite + CSS module types
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 4. What Each Part Does

### 4.1 API Client (`src/api/client.ts`)

- **Base URL:** All requests go to **`/api`** (Vite proxies this to the orchestrator, e.g. `http://localhost:3000`).
- **Auth header:** For every request except login/register we send **`Authorization: Bearer <token>`** (token from `localStorage`).
- **401 handling:** If any request returns 401, we clear token/user in `localStorage` and dispatch **`auth:logout`** so the app can redirect to login.
- **Exports:**
  - **`authApi`:** `login`, `register`, `me`, `logout`.
  - **`chatApi`:** `sendMessage`, `getHistory(sessionId)`, `getSessions`.
  - **`planApi`:** `approve(planId)`, `reject(planId)`.

### 4.2 Types (`src/types/index.ts`)

- **Auth:** `User`, `LoginPayload`, `RegisterPayload`, `AuthResponse`.
- **Chat:** `MessageRole`, `ChatMessage`, `PlanStep`, `PlanPayload`, `SendMessagePayload`, `SendMessageResponse`.
- **Session:** `SessionInfo`.

These align with the expected backend responses so the UI and API client stay in sync.

### 4.3 Auth Context (`src/context/AuthContext.tsx`)

- **State:** `user`, `loading`, `error`.
- **Actions:** `login`, `register`, `logout`, `clearError`.
- **Persistence:** On successful login/register we store `token` and `user` in `localStorage`; on logout or 401 we remove them.
- **Hydration:** On mount we call `authApi.me()` if a token exists; we set `user` from the response or clear storage on failure.
- **Global logout:** Listens for the `auth:logout` event (fired by the API client on 401) and clears user state.

### 4.4 Routing & Protection (`src/App.tsx`)

- **`AuthProvider`** wraps the whole app.
- **Public routes:** `/login`, `/register`. Wrapped in **`PublicRoute`**: if user is logged in, redirect to `/dashboard`.
- **Protected routes:** `/dashboard` and children. Wrapped in **`ProtectedRoute`**: if user is not logged in, redirect to `/login`.
- **Layout route:** `/dashboard` renders **`Layout`** (header + sidebar + outlet). Index route is **Dashboard** (chat); `sessions` route is **Sessions**.
- **Fallbacks:** `/` and unknown paths redirect to `/dashboard` (which may then redirect to login if not authenticated).

### 4.5 Layout

- **Layout:** Flex column: header (fixed), then body (sidebar + main). Main area scrolls; chat area is flex and uses remaining height.
- **Header:** App name “Task Automate”, user display name (or email), Sign out button.
- **Sidebar:** NavLinks to “Chat” (`/dashboard`) and “Sessions” (`/dashboard/sessions`). “Chat” uses `end` so it’s active only on exact `/dashboard`.

### 4.6 Chat UI

- **ChatPanel:** Holds `messages` and `sessionId`. Loads history when `sessionId` is set; on send calls `chatApi.sendMessage`, appends user message then assistant message (and optional plan); handles plan approve/reject via `planApi`.
- **MessageList:** Maps messages to **MessageBubble**; for each message with a pending plan, renders **PlanCard** with steps and Approve/Reject.
- **MessageBubble:** User messages on the right (primary color); assistant on the left (muted background). Shows timestamp.
- **PlanCard:** Shows plan summary, numbered steps, and Approve / Reject buttons.
- **ChatInput:** Controlled textarea; Submit on Enter (Shift+Enter for newline); Send button disabled when empty or while loading.

### 4.7 Styling

- **Global:** `src/index.css` defines CSS variables (e.g. `--primary`, `--bg-page`, `--text-primary`, `--border`, `--danger`) and base styles. Font: **DM Sans** (from Google Fonts in `index.html`).
- **Components:** Each component (or page) that needs scoped styles has a **`.module.css`** file; class names are used via `import styles from './X.module.css'`.

---

## 5. Backend Contract (Expected Routes)

The frontend is ready for a backend that implements the following. All under **base path `/api`** (or same origin + proxy).

| Method | Path | Body / Query | Response | Notes |
|--------|------|-------------|----------|--------|
| POST | `/auth/login` | `{ email, password }` | `{ user, token?, expiresAt? }` | Token stored in localStorage. |
| POST | `/auth/register` | `{ email, password, displayName? }` | `{ user, token?, expiresAt? }` | Same as login after success. |
| GET | `/auth/me` | — | `{ user }` | Header: `Authorization: Bearer <token>`. |
| POST | `/auth/logout` | — | `{ ok }` (optional) | Frontend clears storage regardless. |
| POST | `/chat/send` | `{ text, sessionId? }` | `{ message, plan?, sessionId }` | `message` and optional `plan` (with `id`, `steps`, `summary`, `status`). |
| GET | `/chat/history` | `?sessionId=<id>` | `{ messages }` | Array of `ChatMessage`. |
| GET | `/chat/sessions` | — | `{ sessions }` | Array of `SessionInfo` (id, createdAt, lastActivityAt, messageCount?). |
| POST | `/plan/approve` | `{ planId }` | `{ plan }` (optional) | Frontend updates local plan status to `approved`. |
| POST | `/plan/reject` | `{ planId }` | `{ ok }` (optional) | Frontend updates local plan status to `rejected`. |

- **401:** Any endpoint may return 401; the client will clear token/user and the app will redirect to login.

---

## 6. Running & Building

- **Install:** `npm install` (from `frontend/`).
- **Dev:** `npm run dev` — Vite dev server (default **http://localhost:5173**). Proxy: `/api` → `http://localhost:3000` (set in `vite.config.ts`).
- **Build:** `npm run build` — TypeScript compile + Vite build; output in `dist/`.
- **Preview:** `npm run preview` — Serve the production build locally.

---

## 7. Summary of What Was Done

1. **Vite + React + TypeScript** app with path alias `@` → `src/`.
2. **Auth:** Login and Register pages, `AuthContext` with token/user persistence and `me()` on load; 401 → clear auth and redirect to login.
3. **Dashboard:** Layout with Header and Sidebar; main content = Chat (default) or Sessions.
4. **Chat:** Full flow: send message → show user bubble → call backend → show assistant message and optional plan card → Approve/Reject plan with `planApi`.
5. **Sessions page:** List of sessions from `chatApi.getSessions()`.
6. **API client** with auth header and 401 handling; types aligned to expected backend.
7. **Routing** with public/protected routes and redirects.
8. **Styling** with global variables and CSS modules for a clean, consistent UI.

All of this is designed to work once the backend implements the routes and response shapes described in **Section 5**.
