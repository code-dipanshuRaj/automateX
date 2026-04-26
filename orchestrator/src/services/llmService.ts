import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { executeToolCall } from './toolExecutor';
import { ensureScope, getUser } from './tokenManager';
import type { AuthRequiredPayload, ConversationMessage, UserDoc } from '../types';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

// ─── Tool Definitions (declared to the LLM) ────────────────────────
const TOOL_DECLARATIONS = [
  {
    name: 'create_calendar_event',
    description: 'Create a new Google Calendar event. Requires Google Calendar authorization.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        summary: {
          type: SchemaType.STRING,
          description: 'Title of the calendar event',
        },
        description: {
          type: SchemaType.STRING,
          description: 'Description of the event',
        },
        start: {
          type: SchemaType.STRING,
          description: 'Start datetime in ISO 8601 format (e.g. 2026-04-06T14:00:00+05:30)',
        },
        end: {
          type: SchemaType.STRING,
          description: 'End datetime in ISO 8601 format',
        },
        attendees: {
          type: SchemaType.STRING,
          description: 'Comma-separated list of attendee email addresses (optional)',
        },
      },
      required: ['summary', 'start', 'end'],
    },
  },
  {
    name: 'list_calendar_events',
    description: 'List upcoming Google Calendar events. Requires Google Calendar authorization.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        timeMin: {
          type: SchemaType.STRING,
          description: 'Start of time range in ISO 8601 format',
        },
        timeMax: {
          type: SchemaType.STRING,
          description: 'End of time range in ISO 8601 format',
        },
        maxResults: {
          type: SchemaType.NUMBER,
          description: 'Maximum number of events to return (default 10)',
        },
      },
      required: ['timeMin', 'timeMax'],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email via Gmail. Requires Gmail authorization.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        to: {
          type: SchemaType.STRING,
          description: 'Recipient email address',
        },
        subject: {
          type: SchemaType.STRING,
          description: 'Email subject line',
        },
        body: {
          type: SchemaType.STRING,
          description: 'Plain text email body',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new Google Task. Requires Google Tasks authorization.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: 'Title of the task',
        },
        notes: {
          type: SchemaType.STRING,
          description: 'Notes or description for the task',
        },
        due: {
          type: SchemaType.STRING,
          description: 'Due date in ISO 8601 format (date only, e.g. 2026-04-06T00:00:00Z)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List Google Tasks. Requires Google Tasks authorization.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        maxResults: {
          type: SchemaType.NUMBER,
          description: 'Maximum number of tasks to return (default 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'request_missing_scope',
    description:
      'Call this function when the user asks something that requires a Google service you do not currently have permission for. ' +
      'Check the granted_scopes in the system context. ' +
      'If the required scope is missing, call this function with the required scope name.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        scope_name: {
          type: SchemaType.STRING,
          description:
            'The Google OAuth scope URL needed. One of: ' +
            'https://www.googleapis.com/auth/calendar, ' +
            'https://www.googleapis.com/auth/gmail.send, ' +
            'https://www.googleapis.com/auth/tasks',
        },
        reason: {
          type: SchemaType.STRING,
          description: 'Brief explanation of why this scope is needed',
        },
      },
      required: ['scope_name'],
    },
  },
];

// ─── Scope mapping: tool name → required Google scope ───────────────
const TOOL_SCOPE_MAP: Record<string, string> = {
  create_calendar_event: 'https://www.googleapis.com/auth/calendar',
  list_calendar_events: 'https://www.googleapis.com/auth/calendar',
  send_email: 'https://www.googleapis.com/auth/gmail.send',
  create_task: 'https://www.googleapis.com/auth/tasks',
  list_tasks: 'https://www.googleapis.com/auth/tasks',
};

// ─── Build System Prompt ────────────────────────────────────────────
function buildSystemPrompt(user: UserDoc): string {
  const scopeList = user.grantedScopes.length > 0
    ? user.grantedScopes.map((s) => `  - ${s}`).join('\n')
    : '  (none granted yet)';

  return `You are Task Automate, an intelligent AI assistant that helps users manage their Google Workspace.
You can create calendar events, send emails, and manage tasks.

IMPORTANT RULES:
1. You have access to tools for Google Calendar, Gmail, and Google Tasks.
2. The user's currently granted OAuth scopes are:
${scopeList}

3. BEFORE calling any tool (except request_missing_scope), check if the required scope is in the granted scopes list above.
   - create_calendar_event / list_calendar_events requires: https://www.googleapis.com/auth/calendar
   - send_email requires: https://www.googleapis.com/auth/gmail.send
   - create_task / list_tasks requires: https://www.googleapis.com/auth/tasks

4. If the required scope is NOT in the granted scopes list, you MUST call request_missing_scope with the needed scope. Do NOT try to call the action tool directly.

5. When the user's request is general conversation (greetings, questions, etc.), just respond normally without calling any tools.

6. When creating events or tasks, infer reasonable defaults. Today's date is ${new Date().toISOString().split('T')[0]}. The user's timezone offset is +05:30 (IST).

7. Always confirm what you did after a successful action (e.g., "I've created the calendar event for ...").

8. Be conversational, helpful, and concise.`;
}

// ─── Process a Chat Message ─────────────────────────────────────────
import { v4 as uuidv4 } from 'uuid';
import { savePlan, getPlan, updatePlanStatus } from './planStore';
import type { PlanDoc, PlanStep } from '../types';

export interface ChatResult {
  reply: string;
  authRequired?: AuthRequiredPayload;
  plan?: {
    id: string;
    steps: PlanStep[];
    summary: string;
    status: 'pending';
  };
}

/** Human-readable labels for tool names */
const TOOL_LABELS: Record<string, string> = {
  create_calendar_event: 'Create a calendar event',
  list_calendar_events: 'List calendar events',
  send_email: 'Send an email',
  create_task: 'Create a task',
  list_tasks: 'List tasks',
};

export async function processMessage(
  userId: string,
  userMessage: string,
  conversationHistory: ConversationMessage[],
  sessionId?: string,
): Promise<ChatResult> {
  const user = await getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const model = genAI.getGenerativeModel({
    model: config.geminiModel,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS as any }],
    systemInstruction: buildSystemPrompt(user),
  });

  // Build chat history for Gemini (convert our format to Gemini's)
  const history = conversationHistory
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    }));

  const chat = model.startChat({ history });

  // ── Fetch RAG Context ──
  let ragContext = '';
  try {
    const ragServiceUrl = config.ragServiceUrl || 'http://127.0.0.1:8000';
    const ragRes = await fetch(`${ragServiceUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userMessage, top_k: 3 }),
    });
    if (ragRes.ok) {
      const data = await (ragRes.json() as Promise<{ contexts?: Array<{ content: string }> }>);
      if (data.contexts && data.contexts.length > 0) {
        ragContext = `[Context from Knowledge Base/Uploaded Documents]:\n${data.contexts.map((c) => c.content).join('\n\n')}\n\n`;
        logger.info('rag_context_injected', { userId, contextsFound: data.contexts.length });
      }
    }
  } catch (err) {
    logger.error('rag_query_failed', { error: err instanceof Error ? err.message : String(err) });
  }

  const promptToLLM = ragContext ? `${ragContext}User Query: ${userMessage}` : userMessage;

  // Send user message with built context
  let result = await chat.sendMessage(promptToLLM);
  let response = result.response;

  // Tool-calling loop: handle up to 5 successive iterations
  for (let i = 0; i < 5; i++) {
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) break;

    const parts = candidates[0].content?.parts;
    if (!parts) break;

    // Check for function calls
    const functionCallParts = parts.filter((p) => 'functionCall' in p);
    if (functionCallParts.length === 0) break;

    // ── Separate scope-request calls from action calls ──────────
    const scopeRequests: Array<{ name: string; args: Record<string, unknown> }> = [];
    const actionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    for (const part of functionCallParts) {
      const fc = (part as any).functionCall;
      const toolName: string = fc.name;
      const toolArgs: Record<string, unknown> = fc.args ?? {};

      logger.info('llm_tool_call', { userId, tool: toolName, args: toolArgs });

      if (toolName === 'request_missing_scope') {
        scopeRequests.push({ name: toolName, args: toolArgs });
      } else {
        actionCalls.push({ name: toolName, args: toolArgs });
      }
    }

    // ── Handle scope requests inline (they are not user actions) ──
    if (scopeRequests.length > 0) {
      for (const sr of scopeRequests) {
        const scopeName = sr.args.scope_name as string;
        const reason = (sr.args.reason as string) ?? '';

        const scopeCheck = ensureScope(user, scopeName, userMessage);
        if (scopeCheck) {
          return {
            reply: reason || `I need access to ${scopeCheck.scopeLabel} to do this.`,
            authRequired: scopeCheck,
          };
        }

        // Scope is actually granted — tell the LLM and let it retry
        const functionResponses = [{
          functionResponse: {
            name: sr.name,
            response: { status: 'scope_already_granted', scope: scopeName },
          },
        }];
        result = await chat.sendMessage(functionResponses as any);
        response = result.response;
      }
      // Re-loop to process any new function calls the LLM makes after learning the scope is granted
      continue;
    }

    // ── Action calls: create a plan for user approval ────────────
    if (actionCalls.length > 0) {
      // Server-side scope check for each action
      for (const ac of actionCalls) {
        const requiredScope = TOOL_SCOPE_MAP[ac.name];
        if (requiredScope) {
          const scopeCheck = ensureScope(user, requiredScope, userMessage);
          if (scopeCheck) {
            return {
              reply: `I need access to ${scopeCheck.scopeLabel} to perform this action.`,
              authRequired: scopeCheck,
            };
          }
        }
      }

      // Build a human-readable plan
      const planSteps: PlanStep[] = actionCalls.map((ac) => ({
        action: ac.name,
        args: ac.args,
        description: buildStepDescription(ac.name, ac.args),
      }));

      const summary = planSteps.length === 1
        ? TOOL_LABELS[planSteps[0].action] ?? planSteps[0].action
        : `${planSteps.length} actions to perform`;

      const planId = uuidv4();
      const planDoc: PlanDoc = {
        id: planId,
        userId,
        sessionId: sessionId ?? '',
        steps: planSteps,
        summary,
        status: 'pending',
        rawFunctionCalls: actionCalls,
        chatHistorySnapshot: history,
        createdAt: new Date(),
      };

      savePlan(planDoc);

      logger.info('plan_created', { userId, planId, steps: planSteps.length });

      return {
        reply: `I'd like to do the following. Please review and approve:`,
        plan: {
          id: planId,
          steps: planSteps,
          summary,
          status: 'pending',
        },
      };
    }
  }

  // Extract text response (no tool calls — normal conversation)
  const text = response.text?.() ?? response.candidates?.[0]?.content?.parts
    ?.filter((p: any) => 'text' in p)
    ?.map((p: any) => p.text)
    ?.join('') ?? 'I processed your request.';

  return { reply: text };
}

// ─── Execute an Approved Plan ───────────────────────────────────────

export async function executeApprovedPlan(planId: string): Promise<{
  success: boolean;
  results: Array<{ tool: string; result: Record<string, unknown> }>;
  reply: string;
}> {
  const plan = getPlan(planId);
  if (!plan) throw new Error('Plan not found');
  if (plan.status !== 'approved') throw new Error(`Plan is ${plan.status}, cannot execute`);

  updatePlanStatus(planId, 'executing');

  const results: Array<{ tool: string; result: Record<string, unknown> }> = [];
  const errors: string[] = [];

  for (const fc of plan.rawFunctionCalls) {
    try {
      const toolResult = await executeToolCall(plan.userId, fc.name, fc.args);
      results.push({ tool: fc.name, result: toolResult });
      logger.info('plan_tool_executed', { planId, tool: fc.name, success: true });
    } catch (err) {
      const errorMsg = (err as Error).message;
      logger.error('plan_tool_execution_error', { planId, tool: fc.name, error: errorMsg });
      results.push({ tool: fc.name, result: { error: errorMsg } });
      errors.push(`${TOOL_LABELS[fc.name] ?? fc.name}: ${errorMsg}`);
    }
  }

  updatePlanStatus(planId, 'completed');

  const reply = errors.length > 0
    ? `Plan executed with errors:\n${errors.join('\n')}`
    : `Done! All ${results.length} action(s) completed successfully.`;

  return { success: errors.length === 0, results, reply };
}

// ─── Helpers ────────────────────────────────────────────────────────

function buildStepDescription(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'send_email':
      return `Send email to ${args.to ?? '?'} — "${args.subject ?? ''}"`;
    case 'create_calendar_event':
      return `Create event "${args.summary ?? ''}" from ${args.start ?? '?'} to ${args.end ?? '?'}`;
    case 'list_calendar_events':
      return `List calendar events from ${args.timeMin ?? '?'} to ${args.timeMax ?? '?'}`;
    case 'create_task':
      return `Create task "${args.title ?? ''}"${args.due ? ` due ${args.due}` : ''}`;
    case 'list_tasks':
      return `List your tasks`;
    default:
      return `${toolName}(${JSON.stringify(args)})`;
  }
}
