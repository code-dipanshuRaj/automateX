// Legacy connector interface — kept for reference.
// The new architecture routes tool calls through services/toolExecutor.ts.

export interface TaskPayload {
  type: string;
  data: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  connectorType: string;
  externalId?: string;
  message?: string;
  raw?: unknown;
}
