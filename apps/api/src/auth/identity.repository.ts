import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database.service';

export interface ApplicationIdentity {
  id: string; providerSubject: string; status: string; deletionRequestedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}
export interface IdentityRepository { getOrCreate(subject: string): Promise<ApplicationIdentity> }
export const IDENTITY_REPOSITORY = Symbol('IDENTITY_REPOSITORY');

@Injectable()
export class PrismaIdentityRepository implements IdentityRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async getOrCreate(subject: string): Promise<ApplicationIdentity> {
    try {
      return await this.database.applicationUser.upsert({
        where: { providerSubject: subject }, create: { providerSubject: subject }, update: {},
      });
    } catch (error) {
      // A unique constraint remains the final arbiter if concurrent create paths race.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.database.applicationUser.findUniqueOrThrow({ where: { providerSubject: subject } });
      }
      throw error;
    }
  }
}
