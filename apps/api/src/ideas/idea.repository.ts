import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type IdeaProjectStatus } from '@prisma/client';
import { DatabaseService } from '../database.service';
import { canReadIdeaProject, canTransitionIdeaProject, ideaTransitionFields, type IdeaActor } from './idea-project.policy';
import type { IdeaInput, ListInput } from './idea.input';
const include = { owner: { select: { status: true, deletionRequestedAt: true } } } as const;
export type IdeaRecord = Prisma.IdeaProjectGetPayload<{ include: typeof include }>;
export interface IdeaRepository {
  create(actorId: string, input: IdeaInput): Promise<IdeaRecord>;
  list(actorId: string, options: ListInput): Promise<IdeaRecord[]>;
  read(actorId: string, id: string): Promise<IdeaRecord | null>;
  replace(actorId: string, id: string, input: IdeaInput): Promise<IdeaRecord>;
  transition(actorId: string, id: string, next: IdeaProjectStatus): Promise<IdeaRecord>;
}
export const IDEA_REPOSITORY = Symbol('IDEA_REPOSITORY');
@Injectable()
export class PrismaIdeaRepository implements IdeaRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private async actor(tx: Prisma.TransactionClient, id: string, write: boolean): Promise<IdeaActor> {
    const lock = write ? Prisma.sql`FOR UPDATE` : Prisma.sql`FOR SHARE`;
    const rows = await tx.$queryRaw<IdeaActor[]>`SELECT id, status, "deletionRequestedAt" FROM "ApplicationUser" WHERE id = ${id}::uuid ${lock}`;
    const actor = rows[0];
    if (!actor || actor.status !== 'ACTIVE' || actor.deletionRequestedAt !== null) throw new ForbiddenException('Access denied');
    return actor;
  }
  private async owned(tx: Prisma.TransactionClient, actorId: string, id: string) {
    // Lock the target too: an independent writer may not follow the owner-lock
    // convention. Read its current state only after that writer commits.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "IdeaProject" WHERE id = ${id}::uuid AND "ownerId" = ${actorId}::uuid FOR UPDATE`;
    if (!locked.length) throw new NotFoundException('Idea not found');
    const record = await tx.ideaProject.findFirst({ where: { id, ownerId: actorId }, include });
    if (!record) throw new NotFoundException('Idea not found');
    return record;
  }
  create(actorId: string, input: IdeaInput) {
    return this.db.$transaction(async tx => {
      await this.actor(tx, actorId, true);
      return tx.ideaProject.create({ data: { ...input, ownerId: actorId, status: 'DRAFT' }, include });
    });
  }
  list(actorId: string, options: ListInput) {
    return this.db.$transaction(async tx => {
      await this.actor(tx, actorId, false);
      return tx.ideaProject.findMany({ where: { ownerId: actorId, ...(options.status ? { status: options.status } : {}),
        ...(options.cursor ? { OR: [{ updatedAt: { lt: options.cursor.updatedAt } }, { updatedAt: options.cursor.updatedAt, id: { lt: options.cursor.id } }] } : {}) },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: options.limit + 1, include });
    });
  }
  read(actorId: string, id: string) {
    return this.db.$transaction(async tx => {
      const actor = await this.actor(tx, actorId, false);
      const record = await tx.ideaProject.findFirst({ where: { id, owner: { status: 'ACTIVE', deletionRequestedAt: null }, OR: [{ ownerId: actorId }, { status: 'PUBLISHED', visibility: 'MEMBERS' }] }, include });
      return record && canReadIdeaProject(actor, record) ? record : null;
    });
  }
  replace(actorId: string, id: string, input: IdeaInput) {
    return this.db.$transaction(async tx => {
      await this.actor(tx, actorId, true);
      const record = await this.owned(tx, actorId, id);
      if (record.status === 'ARCHIVED') throw new ConflictException('Invalid idea state');
      return tx.ideaProject.update({ where: { id, ownerId: actorId, status: record.status }, data: input, include });
    });
  }
  transition(actorId: string, id: string, next: IdeaProjectStatus) {
    return this.db.$transaction(async tx => {
      const actor = await this.actor(tx, actorId, true);
      const record = await this.owned(tx, actorId, id);
      if (!canTransitionIdeaProject(actor, record, next)) throw new ConflictException('Invalid idea state');
      let data;
      try { data = ideaTransitionFields(actor, record, next, new Date()); }
      catch { throw new ConflictException('Invalid idea state'); }
      return tx.ideaProject.update({ where: { id, ownerId: actorId, status: record.status }, data, include });
    });
  }
}
