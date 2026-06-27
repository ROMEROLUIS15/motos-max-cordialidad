import { User } from '../entities/user.entity';

export interface UserRepository {
  findById(id: string, tenantId: string): Promise<User | null>;
  findByEmail(email: string, tenantId: string): Promise<User | null>;
  findByTenant(tenantId: string): Promise<User[]>;
  /** Active OWNER whose whatsappPhone matches — used to route admin chats. */
  findOwnerByWhatsappPhone(phone: string, tenantId: string): Promise<User | null>;
  save(user: User): Promise<void>;
  create(user: User): Promise<void>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
