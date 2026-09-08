import 'server-only';

import type { Prisma } from '@/generated/prisma/client';
import { DomainEventStatus } from '@/generated/prisma/enums';
import { handleProjectFeedbackActionRequired } from '@/lib/domain-event-handlers';
import { prisma } from '@/lib/prisma';

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

/**
 * Domain event catalog.
 *
 * This is the general-purpose company-wide event pipe introduced by
 * BATCH_BOA_01. It is intentionally separate from `WorkflowEvent`, which
 * remains scoped to `ProjectWorkflow` instances (see the batch doc for why
 * the two were not merged in this batch).
 *
 * Add new event types here as a discriminated union so every producer and
 * handler stays type-checked against the same payload shape.
 */
export type DomainEventInput = {
  type: 'project_feedback.action_required';
  payload: {
    feedbackId: string;
    projectId: string;
    clientId: string | null;
    ownerId: string;
    followUpDueAt: string;
    priority: 'URGENT' | 'HIGH';
    projectName: string;
  };
};

/**
 * Writes a pending domain event row inside the caller's transaction.
 *
 * This must always be called with the same `tx` that performs the state
 * change the event describes (transactional outbox pattern): the event can
 * only exist if the change it describes actually committed. Never call this
 * with the bare `prisma` client from inside a request handler that also
 * writes other rows in a transaction — pass the transaction client instead.
 */
export async function emitDomainEvent(
  db: DatabaseClient,
  companyId: string,
  event: DomainEventInput,
) {
  return db.domainEvent.create({
    data: {
      companyId,
      type: event.type,
      payload: event.payload,
    },
  });
}

/**
 * Processes a single domain event by id: looks up its registered handler,
 * runs it, and marks the event PROCESSED or FAILED.
 *
 * Handlers are expected to be idempotent on their own (checked against
 * current database state, not against event-delivery guarantees), because
 * this function does not guarantee exactly-once delivery — only at-least
 * dispatched-once, with retry on failure via the sweeper cron.
 */
export async function processDomainEvent(eventId: string) {
  const event = await prisma.domainEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status === DomainEventStatus.PROCESSED) return;

  const handler = domainEventHandlers[event.type];
  if (!handler) {
    await prisma.domainEvent.update({
      where: { id: event.id },
      data: {
        status: DomainEventStatus.FAILED,
        attempts: { increment: 1 },
        lastError: `No handler registered for event type "${event.type}"`,
      },
    });
    return;
  }

  try {
    await handler(event.companyId, event.payload as never);
    await prisma.domainEvent.update({
      where: { id: event.id },
      data: { status: DomainEventStatus.PROCESSED, processedAt: new Date() },
    });
  } catch (error) {
    await prisma.domainEvent.update({
      where: { id: event.id },
      data: {
        status: DomainEventStatus.FAILED,
        attempts: { increment: 1 },
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

/**
 * Sweeps PENDING (or previously FAILED, under the retry cap) events and
 * processes them. This is the safety net for events that were not drained
 * synchronously right after their triggering request — see
 * `dispatchDomainEventNow` for the synchronous path used today.
 */
export async function dispatchPendingDomainEvents({
  limit = 50,
  maxAttempts = 5,
}: { limit?: number; maxAttempts?: number } = {}) {
  const pending = await prisma.domainEvent.findMany({
    where: {
      OR: [
        { status: DomainEventStatus.PENDING },
        { status: DomainEventStatus.FAILED, attempts: { lt: maxAttempts } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let processed = 0;
  let failed = 0;
  for (const event of pending) {
    const before = event.status;
    await processDomainEvent(event.id);
    const after = await prisma.domainEvent.findUnique({
      where: { id: event.id },
      select: { status: true },
    });
    if (after?.status === DomainEventStatus.PROCESSED) processed += 1;
    else if (before !== after?.status || after?.status === DomainEventStatus.FAILED) failed += 1;
  }

  return { scanned: pending.length, processed, failed };
}

/**
 * Synchronous convenience for producers that want the current request to
 * observe the side effect immediately (matches today's user-facing latency
 * for the flows migrated in BATCH_BOA_01). Call this after the emitting
 * transaction has committed, never from inside it.
 */
export async function dispatchDomainEventNow(eventId: string) {
  await processDomainEvent(eventId);
}

type DomainEventHandler = (
  companyId: string,
  payload: DomainEventInput['payload'],
) => Promise<void>;

/**
 * Handler registry. Keep handlers here (or re-export from
 * `domain-event-handlers.ts` files per domain as the catalog grows) so
 * `processDomainEvent` has a single lookup surface.
 */
const domainEventHandlers: Record<string, DomainEventHandler> = {
  'project_feedback.action_required': handleProjectFeedbackActionRequired,
};
