/**
 * Execution Audit & Event Logging Service (Sprint 47 §84, §92).
 */

import { dbRepository } from '../db/repository';
import { DbExecutionEvent } from '../db/schema';

export class ExecutionAuditService {
  private static instance: ExecutionAuditService;

  private constructor() {}

  public static getInstance(): ExecutionAuditService {
    if (!ExecutionAuditService.instance) {
      ExecutionAuditService.instance = new ExecutionAuditService();
    }
    return ExecutionAuditService.instance;
  }

  /**
   * Logs an immutable execution lifecycle event to the audit trail
   */
  public logEvent(
    executionId: string,
    eventType:
      | 'execution.created'
      | 'execution.route_selected'
      | 'execution.transaction_built'
      | 'execution.simulated'
      | 'execution.ready_for_signature'
      | 'execution.signed'
      | 'execution.submitted'
      | 'execution.confirming'
      | 'execution.confirmed'
      | 'execution.failed'
      | 'execution.reorg_detected'
      | 'execution.replaced'
      | 'execution.reconciled',
    payload: any
  ): DbExecutionEvent {
    return dbRepository.logExecutionEvent(executionId, eventType, payload);
  }

  public getEvents(executionId: string): DbExecutionEvent[] {
    return dbRepository.getExecutionEvents(executionId);
  }
}

export const executionAuditService = ExecutionAuditService.getInstance();
