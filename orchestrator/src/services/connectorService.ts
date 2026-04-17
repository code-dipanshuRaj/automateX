// ConnectorService — simplified.
// Most task execution now flows through the LLM tool-calling pipeline
// (llmService.ts -> toolExecutor.ts -> Google APIs).
// This file is kept for any direct connector operations outside the chat flow.

import { logger } from '../utils/logger';

export async function getConnectorStatus(grantedScopes: string[]): Promise<{
  google_calendar: boolean;
  gmail: boolean;
  google_tasks: boolean;
}> {
  return {
    google_calendar: grantedScopes.includes('https://www.googleapis.com/auth/calendar'),
    gmail: grantedScopes.includes('https://www.googleapis.com/auth/gmail.send'),
    google_tasks: grantedScopes.includes('https://www.googleapis.com/auth/tasks'),
  };
}
