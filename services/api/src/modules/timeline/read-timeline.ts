import {
  authorizeConsumerCapability,
  groupTimelineByLocalDate,
  type ConsumerCapabilityContext,
  type TimelineListQuery,
  type TimelineRepository,
} from '@glucora/domain';

export async function readTimeline(
  repository: TimelineRepository,
  authorization: ConsumerCapabilityContext,
  query: TimelineListQuery,
) {
  const decision = authorizeConsumerCapability(authorization);
  if (!decision.allowed) return { ok: false as const, reason: decision.reason };
  const items = await repository.list(authorization.subjectUserId, query);
  return { ok: true as const, view: groupTimelineByLocalDate(items) };
}
