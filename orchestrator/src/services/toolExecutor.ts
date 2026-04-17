import { google } from 'googleapis';
import { getAuthorizedClient } from './tokenManager';
import { logger } from '../utils/logger';

/**
 * Executes a tool call from the LLM by routing it to the appropriate Google API.
 * TokenManager handles token validity. This module is pure API call logic.
 */
export async function executeToolCall(
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case 'create_calendar_event':
      return createCalendarEvent(userId, args);
    case 'list_calendar_events':
      return listCalendarEvents(userId, args);
    case 'send_email':
      return sendEmail(userId, args);
    case 'create_task':
      return createTask(userId, args);
    case 'list_tasks':
      return listTasks(userId, args);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── Google Calendar ────────────────────────────────────────────────

async function createCalendarEvent(
  userId: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const auth = await getAuthorizedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const attendees = args.attendees
    ? String(args.attendees)
        .split(',')
        .map((e) => ({ email: e.trim() }))
    : undefined;

  const event = {
    summary: String(args.summary ?? 'New Event'),
    description: args.description ? String(args.description) : undefined,
    start: { dateTime: String(args.start) },
    end: { dateTime: String(args.end) },
    attendees,
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  logger.info('calendar_event_created', { userId, eventId: res.data.id });

  return {
    success: true,
    eventId: res.data.id,
    htmlLink: res.data.htmlLink,
    summary: res.data.summary,
    start: res.data.start?.dateTime,
    end: res.data.end?.dateTime,
  };
}

async function listCalendarEvents(
  userId: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const auth = await getAuthorizedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: String(args.timeMin),
    timeMax: String(args.timeMax),
    maxResults: Number(args.maxResults ?? 10),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = (res.data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary,
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    htmlLink: e.htmlLink,
  }));

  return { success: true, events, count: events.length };
}

// ─── Gmail ──────────────────────────────────────────────────────────

async function sendEmail(
  userId: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const auth = await getAuthorizedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  const to = String(args.to);
  const subject = String(args.subject);
  const body = String(args.body);

  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}`,
    'utf-8',
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  logger.info('email_sent', { userId, messageId: res.data.id });

  return {
    success: true,
    messageId: res.data.id,
    to,
    subject,
  };
}

// ─── Google Tasks ───────────────────────────────────────────────────

async function createTask(
  userId: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const auth = await getAuthorizedClient(userId);
  const tasks = google.tasks({ version: 'v1', auth });

  // Get default task list
  const taskLists = await tasks.tasklists.list({ maxResults: 1 });
  const taskListId = taskLists.data.items?.[0]?.id ?? '@default';

  const task = {
    title: String(args.title),
    notes: args.notes ? String(args.notes) : undefined,
    due: args.due ? String(args.due) : undefined,
  };

  const res = await tasks.tasks.insert({
    tasklist: taskListId,
    requestBody: task,
  });

  logger.info('task_created', { userId, taskId: res.data.id });

  return {
    success: true,
    taskId: res.data.id,
    title: res.data.title,
    due: res.data.due,
    status: res.data.status,
  };
}

async function listTasks(
  userId: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const auth = await getAuthorizedClient(userId);
  const tasksApi = google.tasks({ version: 'v1', auth });

  // Get default task list
  const taskLists = await tasksApi.tasklists.list({ maxResults: 1 });
  const taskListId = taskLists.data.items?.[0]?.id ?? '@default';

  const res = await tasksApi.tasks.list({
    tasklist: taskListId,
    maxResults: Number(args.maxResults ?? 20),
    showCompleted: false,
  });

  const taskItems = (res.data.items ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    notes: t.notes,
    due: t.due,
    status: t.status,
  }));

  return { success: true, tasks: taskItems, count: taskItems.length };
}
