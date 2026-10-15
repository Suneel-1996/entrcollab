import { fields, type Profile, type ProfileInput } from './model';
export type ProfileRequest = (method: 'GET' | 'PUT', input?: ProfileInput) => Promise<Response>;
export type FailureKind = 'validation' | 'unauthorized' | 'forbidden' | 'unavailable' | 'network';
export class ProfileFailure extends Error {
  constructor(readonly kind: FailureKind) { super('Profile request failed'); }
}
function profileBody(value: unknown, expectedUserId: string): Profile {
  if (!value || typeof value !== 'object') throw new ProfileFailure('unavailable');
  const body = value as Profile;
  if (body.userId !== expectedUserId || typeof body.createdAt !== 'string' || !Number.isFinite(Date.parse(body.createdAt)) || typeof body.updatedAt !== 'string' || !Number.isFinite(Date.parse(body.updatedAt)) || !body.visibility || typeof body.visibility !== 'object') throw new ProfileFailure('unavailable');
  for (const field of fields) {
    if (!['PRIVATE', 'MEMBERS'].includes(body.visibility[field])) throw new ProfileFailure('unavailable');
    if (field === 'skills' || field === 'interests') {
      if (!Array.isArray(body[field]) || body[field].some(v => typeof v !== 'string')) throw new ProfileFailure('unavailable');
    } else if (typeof body[field] !== 'string') throw new ProfileFailure('unavailable');
  }
  // Copy only the owner contract; unexpected provider/server fields never enter UI state.
  return { userId: body.userId, displayName: body.displayName, bio: body.bio, skills: [...body.skills], interests: [...body.interests], availability: body.availability, visibility: { displayName: body.visibility.displayName, bio: body.visibility.bio, skills: body.visibility.skills, interests: body.visibility.interests, availability: body.visibility.availability }, createdAt: body.createdAt, updatedAt: body.updatedAt };
}
export class ProfileClient {
  constructor(private readonly request: ProfileRequest) {}
  private async execute(method: 'GET' | 'PUT', userId: string, input?: ProfileInput) {
    let response: Response;
    try { response = await this.request(method, input); } catch { throw new ProfileFailure('network'); }
    if (response.status === 404 && method === 'GET') return null;
    if (!response.ok) throw new ProfileFailure(response.status === 400 ? 'validation' : response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : 'unavailable');
    try { return profileBody(await response.json(), userId); }
    catch { throw new ProfileFailure('unavailable'); }
  }
  load(userId: string) { return this.execute('GET', userId); }
  async save(userId: string, input: ProfileInput) { const profile = await this.execute('PUT', userId, input); if (!profile) throw new ProfileFailure('unavailable'); return profile; }
}
