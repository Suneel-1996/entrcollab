export const statuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type Status = typeof statuses[number];
export const fields = ['title', 'summary', 'description', 'neededSkills', 'tags', 'visibility'] as const;
export type Field = typeof fields[number];
export interface IdeaInput { title: string; summary: string; description: string; neededSkills: string[]; tags: string[]; visibility: 'PRIVATE' | 'MEMBERS' }
export interface Idea extends IdeaInput { id: string; ownerId: string; status: Status; createdAt: string; updatedAt: string; publishedAt: string | null; archivedAt: string | null }
export type Errors = Partial<Record<Field, string>>;
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function emptyDraft(): IdeaInput { return { title: '', summary: '', description: '', neededSkills: [], tags: [], visibility: 'PRIVATE' }; }
export function draftFor(idea: IdeaInput): IdeaInput { return { title: idea.title, summary: idea.summary, description: idea.description, neededSkills: [...idea.neededSkills], tags: [...idea.tags], visibility: idea.visibility }; }
export function validate(draft: IdeaInput): { input: IdeaInput; errors: Errors } {
  const errors: Errors = {};
  const unsupported = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\p{Surrogate}]/u;
  const text = (field: 'title' | 'summary' | 'description', max: number, required = false) => {
    const value = draft[field].trim();
    if ((required && !value) || [...value].length > max || unsupported.test(value)) errors[field] = `Use ${required ? '1–' : 'up to '}${max} characters without unsupported characters.`;
    return value;
  };
  const tags = (field: 'neededSkills' | 'tags') => {
    const values = draft[field].map(v => v.trim());
    if (values.length > 20 || values.some(v => !v || [...v].length > 50 || unsupported.test(v)) || new Set(values.map(v => v.normalize('NFKC').toLowerCase())).size !== values.length) errors[field] = 'Use up to 20 different entries of 1–50 characters. Remove empty entries.';
    return values;
  };
  const input = { title: text('title', 120, true), summary: text('summary', 280), description: text('description', 5000), neededSkills: tags('neededSkills'), tags: tags('tags'), visibility: draft.visibility };
  if (!['PRIVATE', 'MEMBERS'].includes(draft.visibility)) errors.visibility = 'Choose a visibility setting.';
  return { input, errors };
}
export function sameDraft(a: IdeaInput, b: IdeaInput) { return fields.every(field => JSON.stringify(a[field]) === JSON.stringify(b[field])); }
export function audience(idea: Idea) { return idea.status === 'PUBLISHED' && idea.visibility === 'MEMBERS' ? 'Signed-in members' : 'Only you'; }
