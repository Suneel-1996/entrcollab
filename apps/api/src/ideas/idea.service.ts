import { HttpException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { IDEA_REPOSITORY, type IdeaRecord, type IdeaRepository } from './idea.repository';
import { emptyAction, ideaId, nextCursor, parseIdea, parseList } from './idea.input';
function content(record: IdeaRecord) {
  return { id: record.id, ownerId: record.ownerId, title: record.title, summary: record.summary, description: record.description,
    neededSkills: record.neededSkills, tags: record.tags, createdAt: record.createdAt, updatedAt: record.updatedAt, publishedAt: record.publishedAt };
}
function owned(record: IdeaRecord) { return { ...content(record), status: record.status, visibility: record.visibility, archivedAt: record.archivedAt }; }
@Injectable()
export class IdeaService {
  constructor(@Inject(IDEA_REPOSITORY) private readonly ideas: IdeaRepository) {}
  private async query<T>(fn: () => Promise<T>) {
    try { return await fn(); }
    catch (error) { if (error instanceof HttpException) throw error; throw new ServiceUnavailableException('Service unavailable'); }
  }
  async create(actorId: string, body: unknown) {
    const input = parseIdea(body); return owned(await this.query(() => this.ideas.create(actorId, input)));
  }
  async list(actorId: string, query: unknown) {
    const options = parseList(query, actorId); const rows = await this.query(() => this.ideas.list(actorId, options));
    const items = rows.slice(0, options.limit);
    return { items: items.map(owned), nextCursor: rows.length > options.limit && items.length ? nextCursor(actorId, options.status, items[items.length - 1]) : null };
  }
  async read(actorId: string, id: string) {
    const record = await this.query(() => this.ideas.read(actorId, ideaId(id)));
    if (!record) throw new NotFoundException('Idea not found');
    return record.ownerId === actorId ? owned(record) : content(record);
  }
  async replace(actorId: string, id: string, body: unknown) {
    const target = ideaId(id); const input = parseIdea(body); return owned(await this.query(() => this.ideas.replace(actorId, target, input)));
  }
  async action(actorId: string, id: string, body: unknown, next: 'PUBLISHED' | 'ARCHIVED') {
    const target = ideaId(id); emptyAction(body); return owned(await this.query(() => this.ideas.transition(actorId, target, next)));
  }
}
