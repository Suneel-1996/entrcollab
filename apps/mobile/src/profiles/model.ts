export const fields = ['displayName', 'bio', 'skills', 'interests', 'availability'] as const;
export type Field = typeof fields[number];
export type Visibility = 'PRIVATE' | 'MEMBERS';
export interface ProfileInput {
  displayName: string; bio: string; skills: string[]; interests: string[]; availability: string;
  visibility: Record<Field, Visibility>;
}
export interface Profile extends ProfileInput { userId: string; createdAt: string; updatedAt: string }
export interface Draft { displayName: string; bio: string; skills: string[]; interests: string[]; availability: string; visibility: Record<Field, Visibility> }
export type FormErrors = Partial<Record<Field, string>>;
export function emptyDraft(): Draft {
  return { displayName: '', bio: '', skills: [], interests: [], availability: '', visibility: { displayName: 'PRIVATE', bio: 'PRIVATE', skills: 'PRIVATE', interests: 'PRIVATE', availability: 'PRIVATE' } };
}
export function toDraft(profile: Profile): Draft {
  return { displayName: profile.displayName, bio: profile.bio, skills: [...profile.skills], interests: [...profile.interests], availability: profile.availability, visibility: { ...profile.visibility } };
}
export function validateDraft(draft: Draft): { input: ProfileInput; errors: FormErrors } {
  const errors: FormErrors = {};
  const text = (field: 'displayName' | 'bio' | 'availability', max: number, required = false) => {
    const value = draft[field].trim();
    if ((required && !value) || [...value].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) errors[field] = required ? `Enter 1–${max} characters.` : `Use up to ${max} characters without unsupported control characters.`;
    return value;
  };
  const tags = (field: 'skills' | 'interests') => {
    const values = draft[field].map(v => v.trim());
    if (values.length > 20 || values.some(v => !v || [...v].length > 50 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v)) || new Set(values.map(v => v.normalize('NFKC').toLowerCase())).size !== values.length) errors[field] = 'Use up to 20 different entries, with 1–50 characters each. Remove any empty entries.';
    return values;
  };
  const input = { displayName: text('displayName', 80, true), bio: text('bio', 2000), skills: tags('skills'), interests: tags('interests'), availability: text('availability', 200), visibility: { ...draft.visibility } };
  for (const field of fields) if (!['PRIVATE', 'MEMBERS'].includes(draft.visibility[field])) errors[field] = 'Choose a visibility setting.';
  return { input, errors };
}
export function sameDraft(a: Draft, b: Draft) {
  return fields.every(field => (Array.isArray(a[field]) ? JSON.stringify(a[field]) === JSON.stringify(b[field]) : a[field] === b[field]) && a.visibility[field] === b.visibility[field]);
}
