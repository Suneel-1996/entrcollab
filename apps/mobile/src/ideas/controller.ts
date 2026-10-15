import { IdeaClient, IdeaFailure } from './client';
import { draftFor, emptyDraft, sameDraft, validate, type Errors, type Idea, type IdeaInput, type Status } from './model';
export interface IdeaState {
  screen: 'list' | 'detail' | 'form'; busy: boolean; items: Idea[]; cursor: string | null; filter?: Status;
  idea: Idea | null; draft: IdeaInput; errors: Errors; dirty: boolean; message: string;
  confirmation: 'share' | 'publish' | 'archive' | null; needsReload: boolean; uncertainCreate: boolean; retry: 'list' | 'detail' | null; targetId: string | null;
}
export function initialState(): IdeaState { return { screen: 'list', busy: false, items: [], cursor: null, idea: null, draft: emptyDraft(), errors: {}, dirty: false, message: '', confirmation: null, needsReload: false, uncertainCreate: false, retry: null, targetId: null }; }
const messages = { validation: 'Check the fields and try again.', missing: 'This idea is unavailable.', conflict: 'The idea changed. Reload its saved state before editing or trying another action.', unavailable: 'The service is unavailable. Please try again.', network: 'Could not reach the service. Check your connection.' };
export class IdeaController {
  private state = initialState(); private listeners = new Set<(state: IdeaState) => void>(); private epoch = 0; private stopped = false;
  constructor(private readonly client: IdeaClient, private readonly userId: string, private readonly accessDenied: () => void) {}
  get snapshot() { return this.state; }
  subscribe(listener: (state: IdeaState) => void) { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  private set(patch: Partial<IdeaState>) { if (this.stopped) return; this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(this.state); }
  stop() { this.stopped = true; this.epoch++; this.state = initialState(); this.listeners.clear(); }
  private allowed() { return !this.stopped && !this.state.busy && !this.state.confirmation; }
  private begin() { const epoch = ++this.epoch; this.set({ busy: true, message: '', retry: null }); return epoch; }
  private current(epoch: number) { return !this.stopped && epoch === this.epoch; }
  private fail(error: unknown, epoch: number): string | null {
    if (!this.current(epoch)) return null;
    const kind = error instanceof IdeaFailure ? error.kind : 'unavailable';
    if (kind === 'unauthorized' || kind === 'forbidden') { this.set(initialState()); this.stop(); this.accessDenied(); return null; }
    this.set({ busy: false, message: messages[kind] }); return kind;
  }
  async list(selected: Status | 'ALL' = this.state.filter ?? 'ALL', more = false) {
    if (!this.allowed() || (more && !this.state.cursor)) return;
    const filter = selected === 'ALL' ? undefined : selected;
    const cursor = more ? this.state.cursor! : undefined; const epoch = this.begin();
    if (!more) this.set({ screen: 'list', items: [], cursor: null, filter, idea: null, needsReload: false });
    try {
      const page = await this.client.list(this.userId, filter, cursor);
      if (!this.current(epoch)) return;
      const items = more ? [...new Map([...this.state.items, ...page.items].map(v => [v.id, v])).values()] : page.items;
      this.set({ items, cursor: page.nextCursor, busy: false });
    } catch (error) { if (this.fail(error, epoch)) this.set({ retry: more ? null : 'list' }); }
  }
  async open(id: string) {
    if (!this.allowed()) return;
    const epoch = this.begin(); this.set({ screen: 'detail', idea: null, targetId: id, needsReload: true });
    try { const idea = await this.client.read(this.userId, id); if (this.current(epoch)) this.set({ idea, busy: false, needsReload: false, draft: emptyDraft(), dirty: false, uncertainCreate: false }); }
    catch (error) { if (this.fail(error, epoch)) this.set({ retry: 'detail' }); }
  }
  newDraft() { if (this.allowed() && !this.state.uncertainCreate) this.set({ screen: 'form', idea: null, draft: emptyDraft(), dirty: false, errors: {}, message: '', needsReload: false }); }
  edit() { if (this.allowed() && this.state.idea && this.state.idea.status !== 'ARCHIVED' && !this.state.needsReload) this.set({ screen: 'form', draft: draftFor(this.state.idea), dirty: false, errors: {}, message: '' }); }
  change<K extends keyof IdeaInput>(field: K, value: IdeaInput[K]) {
    if (!this.allowed() || this.state.screen !== 'form' || this.state.needsReload || this.state.uncertainCreate) return;
    const draft = { ...this.state.draft, [field]: value };
    this.set({ draft, errors: {}, dirty: !sameDraft(draft, this.state.idea ? draftFor(this.state.idea) : emptyDraft()) });
  }
  cancel() {
    if (!this.allowed()) return;
    if (this.state.idea) this.set({ screen: 'detail', draft: emptyDraft(), dirty: false, errors: {}, message: '' });
    else { this.set({ uncertainCreate: false, draft: emptyDraft(), dirty: false, errors: {} }); void this.list(); }
  }
  resumeDraft() { if (this.allowed() && this.state.uncertainCreate) this.set({ screen: 'form', uncertainCreate: false, message: 'Check that no saved copy exists before saving again.' }); }
  async requestSave() {
    if (!this.allowed() || this.state.screen !== 'form' || this.state.needsReload || this.state.uncertainCreate || this.state.idea?.status === 'ARCHIVED') return;
    const { errors } = validate(this.state.draft); this.set({ errors }); if (Object.keys(errors).length) return;
    if (this.state.idea?.status === 'PUBLISHED' && this.state.draft.visibility === 'MEMBERS') { this.set({ confirmation: 'share' }); return; }
    await this.save();
  }
  requestAction(action: 'publish' | 'archive') {
    if (!this.allowed() || this.state.screen !== 'detail' || !this.state.idea || this.state.needsReload || this.state.idea.status === 'ARCHIVED' || (action === 'publish' && this.state.idea.status !== 'DRAFT')) return;
    this.set({ confirmation: action });
  }
  cancelConfirmation() { this.set({ confirmation: null }); }
  async confirm() {
    if (this.stopped || this.state.busy || !this.state.confirmation) return;
    const action = this.state.confirmation; this.set({ confirmation: null });
    if (action === 'share') { await this.save(); return; }
    const idea = this.state.idea; if (!idea) return;
    const epoch = this.begin();
    try { const saved = await this.client.action(this.userId, idea.id, action); if (this.current(epoch)) this.set({ idea: saved, busy: false, message: action === 'publish' ? 'Idea published.' : 'Idea archived.' }); }
    catch (error) { if (this.fail(error, epoch)) this.set({ needsReload: true, message: 'The action may have completed. Reload the saved idea before continuing.' }); }
  }
  private async save() {
    const { input, errors } = validate(this.state.draft); this.set({ errors }); if (Object.keys(errors).length) return;
    const id = this.state.idea?.id; const epoch = this.begin();
    try { const saved = await this.client.save(this.userId, input, id); if (this.current(epoch)) this.set({ screen: 'detail', idea: saved, draft: emptyDraft(), dirty: false, errors: {}, busy: false, message: 'Idea saved.', needsReload: false, uncertainCreate: false }); }
    catch (error) {
      const kind = this.fail(error, epoch); if (!kind) return;
      if (!id && ['network', 'unavailable'].includes(kind)) this.set({ uncertainCreate: true, message: 'This save may have completed. Check My Ideas for a saved copy before deciding to submit again.' });
      if (id && kind !== 'validation') this.set({ needsReload: true, message: 'Your draft is kept here, but the saved idea may have changed. Reload before continuing.' });
    }
  }
}
