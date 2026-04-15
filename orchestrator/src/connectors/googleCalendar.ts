// Connectors are now simplified — Google API calls are routed through
// the toolExecutor service, which uses TokenManager for auth.
// This file is kept for backward compatibility with any direct connector usage.

import { google } from 'googleapis';
import { getAuthorizedClient } from '../services/tokenManager';

export async function createCalendarEvent(userId: string, eventData: {
  summary: string;
  description?: string;
  start: string;
  end: string;
  attendees?: string[];
}) {
  const auth = await getAuthorizedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: eventData.summary,
    description: eventData.description,
    start: { dateTime: eventData.start },
    end: { dateTime: eventData.end },
    attendees: eventData.attendees?.map((email) => ({ email })),
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return res.data;
}

export async function listCalendarEvents(userId: string, timeMin: string, timeMax: string, maxResults = 10) {
  const auth = await getAuthorizedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items ?? [];
}
