import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CreateProjectInput, UpdateProjectInput } from '@rum/shared';
import { and, eq } from 'drizzle-orm';
import { ApiException } from '../common/errors/api-exception.js';
import { DATABASE, type Database } from '../db/database.js';
import { projects } from '../db/schema.js';

const columns = {
  id: projects.id,
  name: projects.name,
  allowedOrigins: projects.allowedOrigins,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
};

const owned = (ownerId: string, id: string) =>
  and(eq(projects.id, id), eq(projects.ownerId, ownerId));

@Injectable()
export class ProjectsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(ownerId: string, input: CreateProjectInput) {
    const [project] = await this.db
      .insert(projects)
      .values({ ownerId, ...input })
      .returning(columns);
    return project!;
  }

  list(ownerId: string) {
    return this.db
      .select(columns)
      .from(projects)
      .where(eq(projects.ownerId, ownerId))
      .orderBy(projects.createdAt, projects.id);
  }

  async get(ownerId: string, id: string) {
    const [project] = await this.db
      .select(columns)
      .from(projects)
      .where(owned(ownerId, id));
    return found(project);
  }

  async update(ownerId: string, id: string, input: UpdateProjectInput) {
    const [project] = await this.db
      .update(projects)
      .set({ ...input, updatedAt: new Date() })
      .where(owned(ownerId, id))
      .returning(columns);
    return found(project);
  }

  async delete(ownerId: string, id: string): Promise<void> {
    const [project] = await this.db
      .delete(projects)
      .where(owned(ownerId, id))
      .returning({ id: projects.id });
    found(project);
  }
}

function found<T>(project: T | undefined): T {
  if (!project) {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      'PROJECT_NOT_FOUND',
      'Project not found',
    );
  }
  return project;
}
