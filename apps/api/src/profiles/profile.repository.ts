import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Profile } from '@prisma/client';
import { DatabaseService } from '../database.service';
import { type ProfileInput } from './profile.input';

export type ProfileRecord = Profile;
export interface ProfileRepository {
  own(userId: string): Promise<ProfileRecord | null>;
  member(userId: string): Promise<ProfileRecord | null>;
  replace(userId: string, input: ProfileInput): Promise<ProfileRecord>;
}
export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');
@Injectable()
export class PrismaProfileRepository implements ProfileRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  own(userId: string) { return this.db.profile.findUnique({ where: { userId } }); }
  member(userId: string) {
    return this.db.profile.findFirst({ where: { userId, user: { status: 'ACTIVE', deletionRequestedAt: null } } });
  }
  async replace(userId: string, input: ProfileInput) {
    return this.db.$transaction(async tx => {
      // Serialize updates and state changes on the owner row, including first creation.
      const owners = await tx.$queryRaw<{ status: string; deletionRequestedAt: Date | null }[]>`
        SELECT "status", "deletionRequestedAt" FROM "ApplicationUser" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      if (owners.length !== 1 || owners[0].status !== 'ACTIVE' || owners[0].deletionRequestedAt !== null) throw new ForbiddenException('Access denied');
      const data = { displayName: input.displayName, bio: input.bio, skills: input.skills, interests: input.interests, availability: input.availability,
        displayNameVisibility: input.visibility.displayName, bioVisibility: input.visibility.bio, skillsVisibility: input.visibility.skills,
        interestsVisibility: input.visibility.interests, availabilityVisibility: input.visibility.availability };
      return tx.profile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    });
  }
}
