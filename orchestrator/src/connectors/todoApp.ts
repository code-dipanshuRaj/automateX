// Local Todo connector — stored in MongoDB (no Google API needed).
// Kept as a simple fallback for local task management.

import { randomUUID } from 'crypto';
import { getDatabase } from '../db/mongo';
import type { TaskDoc } from '../types';

export async function createTodoItem(userId: string, data: {
  title: string;
  description?: string;
  dueDate?: string;
}) {
  const db = await getDatabase();
  const tasks = db.collection<TaskDoc>('tasks');
  const now = new Date();
  const id = randomUUID();

  const doc: TaskDoc = {
    _id: id,
    planId: 'ad-hoc',
    type: 'todo',
    payload: { ...data, userId },
    status: 'pending',
    createdAt: now,
  };

  await tasks.insertOne(doc);
  return doc;
}

export async function listTodoItems(userId: string) {
  const db = await getDatabase();
  const tasks = db.collection<TaskDoc>('tasks');
  return tasks.find({
    type: 'todo',
    'payload.userId': userId,
    status: { $ne: 'completed' },
  }).toArray();
}
