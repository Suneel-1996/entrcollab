import { ProfileClient, ProfileFailure } from './client';
import { emptyDraft, sameDraft, toDraft, validateDraft, type Draft, type Field, type FormErrors, type Profile, type Visibility } from './model';
export interface ProfileState {
  phase: 'loading' | 'view' | 'edit' | 'saving' | 'loadError';
  profile: Profile | null; draft: Draft; errors: FormErrors; message?: string; dirty: boolean;
}
export class ProfileController {
  private state: ProfileState = { phase: 'loading', profile: null, draft: emptyDraft(), errors: {}, dirty: false };
  private listeners = new Set<(state: ProfileState) => void>();
  private epoch = 0;
  private stopped = false;
  constructor(private readonly client: ProfileClient, private readonly userId: string, private readonly accessDenied: () => void) {}
  get snapshot() { return this.state; }
  subscribe(listener: (state: ProfileState) => void) { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  private publish(state: ProfileState) { this.state = state; for (const listener of this.listeners) listener(state); }
  private failed(error: unknown, saving: boolean) {
    if (error instanceof ProfileFailure && ['unauthorized', 'forbidden'].includes(error.kind)) {
      this.publish({ phase: 'loadError', profile: null, draft: emptyDraft(), errors: {}, dirty: false, message: 'Your session cannot access this profile. Please sign in again.' });
      this.accessDenied(); return;
    }
    const message = error instanceof ProfileFailure && error.kind === 'validation' ? 'The service could not accept these details. Review the form and retry.'
      : saving ? 'We could not confirm your save. Your changes are still here. Retry, or reload to check the saved profile.' : 'We could not load your profile. Check your connection and retry.';
    this.publish({ ...this.state, phase: saving ? 'edit' : 'loadError', message });
  }
  async load() {
    if (this.stopped || this.state.phase === 'saving') return;
    const epoch = ++this.epoch;
    this.publish({ ...this.state, phase: 'loading', message: undefined });
    try {
      const profile = await this.client.load(this.userId);
      if (!this.stopped && epoch === this.epoch) this.publish({ phase: profile ? 'view' : 'edit', profile, draft: profile ? toDraft(profile) : emptyDraft(), errors: {}, dirty: false });
    } catch (error) { if (!this.stopped && epoch === this.epoch) this.failed(error, false); }
  }
  edit() { if (this.state.phase === 'view') this.publish({ ...this.state, phase: 'edit', draft: this.state.profile ? toDraft(this.state.profile) : emptyDraft(), errors: {}, message: undefined, dirty: false }); }
  change(field: 'displayName' | 'bio' | 'availability', value: string) {
    if (this.state.phase !== 'edit') return;
    this.updateDraft({ ...this.state.draft, [field]: value }, field);
  }
  tags(field: 'skills' | 'interests', values: string[]) {
    if (this.state.phase !== 'edit') return;
    this.updateDraft({ ...this.state.draft, [field]: [...values] }, field);
  }
  visibility(field: Field, value: Visibility) {
    if (this.state.phase !== 'edit') return;
    this.updateDraft({ ...this.state.draft, visibility: { ...this.state.draft.visibility, [field]: value } }, field);
  }
  private updateDraft(draft: Draft, field: Field) {
    const errors = { ...this.state.errors }; delete errors[field];
    this.publish({ ...this.state, draft, errors, message: undefined, dirty: !sameDraft(draft, this.state.profile ? toDraft(this.state.profile) : emptyDraft()) });
  }
  cancel() {
    if (this.state.phase !== 'edit' || !this.state.profile) return;
    this.publish({ ...this.state, phase: 'view', draft: toDraft(this.state.profile), errors: {}, message: undefined, dirty: false });
  }
  async save() {
    if (this.stopped || this.state.phase !== 'edit') return;
    const { input, errors } = validateDraft(this.state.draft);
    if (Object.keys(errors).length) { this.publish({ ...this.state, errors, message: 'Check the highlighted fields.' }); return; }
    const epoch = ++this.epoch;
    this.publish({ ...this.state, phase: 'saving', errors: {}, message: undefined });
    try {
      const profile = await this.client.save(this.userId, input);
      if (!this.stopped && epoch === this.epoch) this.publish({ phase: 'view', profile, draft: toDraft(profile), errors: {}, dirty: false, message: 'Profile saved.' });
    } catch (error) { if (!this.stopped && epoch === this.epoch) this.failed(error, true); }
  }
  stop() { this.stopped = true; ++this.epoch; this.listeners.clear(); this.state = { phase: 'loading', profile: null, draft: emptyDraft(), errors: {}, dirty: false }; }
}
