import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { generateToken, sha256 } from '../common/crypto/tokens.js';
import { ApiException } from '../common/errors/api-exception.js';
import { DATABASE, type Database } from '../db/database.js';
import { apiKeys, projects } from '../db/schema.js';
import { ProjectsService } from '../projects/projects.service.js';

const columns = {
  id: apiKeys.id,
  prefix: apiKeys.prefix,
  createdAt: apiKeys.createdAt,
  revokedAt: apiKeys.revokedAt,
};

@Injectable()
export class ApiKeysService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly projects: ProjectsService,
  ) {}

  async create(ownerId: string, projectId: string) {
    await this.projects.get(ownerId, projectId);
    const key = generateToken('pk_');
    const [record] = await this.db
      .insert(apiKeys)
      .values({ projectId, keyHash: sha256(key), prefix: key.slice(0, 11) })
      .returning(columns);
    return { ...record!, key };
  }

  async list(ownerId: string, projectId: string) {
    await this.projects.get(ownerId, projectId);
    return this.db
      .select(columns)
      .from(apiKeys)
      .where(eq(apiKeys.projectId, projectId))
      .orderBy(apiKeys.createdAt, apiKeys.id);
  }

  async revoke(
    ownerId: string,
    projectId: string,
    keyId: string,
  ): Promise<void> {
    await this.projects.get(ownerId, projectId);
    const revoked = await this.db
      .update(apiKeys)
      .set({ revokedAt: sql`coalesce(${apiKeys.revokedAt}, now())` })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.projectId, projectId)))
      .returning({ id: apiKeys.id });
    if (revoked.length === 0) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'API_KEY_NOT_FOUND',
        'API key not found',
      );
    }
  }

  async findProject(key: string) {
    const [project] = await this.db
      .select({ id: projects.id, allowedOrigins: projects.allowedOrigins })
      .from(apiKeys)
      .innerJoin(projects, eq(projects.id, apiKeys.projectId))
      .where(and(eq(apiKeys.keyHash, sha256(key)), isNull(apiKeys.revokedAt)));
    return project;
  }
}
