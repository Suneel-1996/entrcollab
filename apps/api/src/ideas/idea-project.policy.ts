import type { IdeaProjectStatus, IdeaProjectVisibility } from '@prisma/client';

export interface IdeaActor { id: string; status: string; deletionRequestedAt: Date | null }
export interface IdeaPolicyRecord {
  ownerId: string; status: IdeaProjectStatus; visibility: IdeaProjectVisibility;
  owner: { status: string; deletionRequestedAt: Date | null };
}
export const IDEA_TRANSITIONS: Readonly<Record<IdeaProjectStatus, readonly IdeaProjectStatus[]>> = Object.freeze({
  DRAFT: Object.freeze(['PUBLISHED', 'ARCHIVED'] as const),
  PUBLISHED: Object.freeze(['ARCHIVED'] as const),
  ARCHIVED: Object.freeze([]),
});
function active(account: { status: string; deletionRequestedAt: Date | null }) {
  return account.status === 'ACTIVE' && account.deletionRequestedAt === null;
}
// Callers must come from verified server authentication, never request payloads.
export function canReadIdeaProject(actor: IdeaActor | null, idea: IdeaPolicyRecord) {
  if (!actor || !active(actor) || !active(idea.owner)) return false;
  if (actor.id === idea.ownerId) return true;
  return idea.status === 'PUBLISHED' && idea.visibility === 'MEMBERS';
}
export function canTransitionIdeaProject(actor: IdeaActor | null, idea: IdeaPolicyRecord, next: IdeaProjectStatus) {
  return !!actor && active(actor) && active(idea.owner) && actor.id === idea.ownerId && IDEA_TRANSITIONS[idea.status].includes(next);
}
export function ideaTransitionFields(actor: IdeaActor | null, idea: IdeaPolicyRecord & { createdAt: Date; publishedAt: Date | null; archivedAt: Date | null }, next: IdeaProjectStatus, at: Date) {
  if (!canTransitionIdeaProject(actor, idea, next)) throw new Error('Idea transition denied');
  if (!Number.isFinite(at.getTime()) || at < idea.createdAt || (idea.publishedAt && at < idea.publishedAt)) throw new Error('Invalid idea transition time');
  // Publication never implicitly changes PRIVATE to MEMBERS. State and visibility
  // remain independent; archive visibility is masked by the read policy.
  return { status: next, publishedAt: next === 'PUBLISHED' ? at : idea.publishedAt, archivedAt: next === 'ARCHIVED' ? at : null };
}
