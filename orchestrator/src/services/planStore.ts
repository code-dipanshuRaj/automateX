import type { PlanDoc } from '../types';

/**
 * In-memory plan store.
 * In production this should be backed by MongoDB/Redis,
 * but for now a Map keeps things simple and avoids extra infra.
 */
const store = new Map<string, PlanDoc>();

export function savePlan(plan: PlanDoc): void {
  store.set(plan.id, plan);
}

export function getPlan(planId: string): PlanDoc | undefined {
  return store.get(planId);
}

export function updatePlanStatus(planId: string, status: PlanDoc['status']): PlanDoc | undefined {
  const plan = store.get(planId);
  if (!plan) return undefined;
  plan.status = status;
  store.set(planId, plan);
  return plan;
}

export function deletePlan(planId: string): void {
  store.delete(planId);
}
