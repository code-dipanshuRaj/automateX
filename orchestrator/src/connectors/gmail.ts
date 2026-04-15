// Simplified Gmail connector — pure API wrapper.
// Auth is handled by TokenManager.

import { google } from 'googleapis';
import { getAuthorizedClient } from '../services/tokenManager';

export async function sendEmail(userId: string, emailData: {
  to: string;
  subject: string;
  body: string;
}) {
  const auth = await getAuthorizedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  const raw = Buffer.from(
    `To: ${emailData.to}\r\nSubject: ${emailData.subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${emailData.body}`,
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

  return res.data;
}
