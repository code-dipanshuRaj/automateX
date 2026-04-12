// Simplified connectors index — re-exports for direct usage.
// The main flow now goes through services/toolExecutor.ts which calls Google APIs directly.

export { createCalendarEvent, listCalendarEvents } from './googleCalendar';
export { sendEmail } from './gmail';
export { createTask, listTasks } from './googleTasks';
