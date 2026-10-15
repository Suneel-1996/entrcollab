import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PROFILE_FIELDS, parseProfile } from './profile.input';
import { PROFILE_REPOSITORY, type ProfileRecord, type ProfileRepository } from './profile.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ownerView(profile: ProfileRecord) {
  return { userId: profile.userId, displayName: profile.displayName, bio: profile.bio, skills: profile.skills,
    interests: profile.interests, availability: profile.availability,
    visibility: { displayName: profile.displayNameVisibility, bio: profile.bioVisibility, skills: profile.skillsVisibility,
      interests: profile.interestsVisibility, availability: profile.availabilityVisibility },
    createdAt: profile.createdAt, updatedAt: profile.updatedAt };
}
@Injectable()
export class ProfileService {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}
  private async query<T>(fn: () => Promise<T>): Promise<T> {
    try { return await fn(); }
    catch (error) { if (error instanceof ForbiddenException) throw error; throw new ServiceUnavailableException('Service unavailable'); }
  }
  async own(userId: string) {
    const profile = await this.query(() => this.profiles.own(userId));
    if (!profile) throw new NotFoundException('Profile not found');
    return ownerView(profile);
  }
  async replace(userId: string, body: unknown) {
    const input = parseProfile(body);
    return ownerView(await this.query(() => this.profiles.replace(userId, input)));
  }
  async member(callerId: string, targetId: string) {
    if (!UUID.test(targetId)) throw new BadRequestException('Invalid profile identifier');
    if (callerId === targetId) return this.own(callerId);
    const profile = await this.query(() => this.profiles.member(targetId));
    if (!profile) throw new NotFoundException('Profile not found');
    const fields: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) if (profile[`${field}Visibility`] === 'MEMBERS') fields[field] = profile[field];
    if (!Object.keys(fields).length) throw new NotFoundException('Profile not found');
    return { userId: profile.userId, ...fields };
  }
}
