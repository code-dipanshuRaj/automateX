// Google Tasks connector — pure API wrapper.
// Auth is handled by TokenManager.

import { google } from 'googleapis';
import { getAuthorizedClient } from '../services/tokenManager';

export async function createTask(userId: string, taskData: {
  title: string;
  notes?: string;
  due?: string;
}) {
  const auth = await getAuthorizedClient(userId);
  const tasks = google.tasks({ version: 'v1', auth });

  const taskLists = await tasks.tasklists.list({ maxResults: 1 });
  const taskListId = taskLists.data.items?.[0]?.id ?? '@default';

  const res = await tasks.tasks.insert({
    tasklist: taskListId,
    requestBody: {
      title: taskData.title,
      notes: taskData.notes,
      due: taskData.due,
    },
  });

  return res.data;
}

export async function listTasks(userId: string, maxResults = 20) {
  const auth = await getAuthorizedClient(userId);
  const tasksApi = google.tasks({ version: 'v1', auth });

  const taskLists = await tasksApi.tasklists.list({ maxResults: 1 });
  const taskListId = taskLists.data.items?.[0]?.id ?? '@default';

  const res = await tasksApi.tasks.list({
    tasklist: taskListId,
    maxResults,
    showCompleted: false,
  });

  return res.data.items ?? [];
}
