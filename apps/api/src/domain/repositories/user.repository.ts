import { User } from '../entities/user.entity';

export interface UserRepository {
  findById(id: string, tenantId: string): Promise<User | null>;
  findByEmail(email: string, tenantId: string): Promise<User | null>;
  findByTenant(tenantId: string): Promise<User[]>;
  save(user: User): Promise<void>;
  create(user: User): Promise<void>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
