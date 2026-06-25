import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

interface PermissionCacheEntry {
  permissions: string[];
  expiresAt: number;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly cache = new Map<string, PermissionCacheEntry>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    );

    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JWTPayload | undefined;

    if (!user) throw new ForbiddenException('User not authenticated');

    const permissions = await this.getPermissionsForRole(user.roleId);
    const [module] = requiredPermission.split(':');

    const hasPermission =
      permissions.includes(requiredPermission) || permissions.includes(`${module}:*`);

    if (!hasPermission) {
      throw new ForbiddenException(`Missing permission: ${requiredPermission}`);
    }

    return true;
  }

  private async getPermissionsForRole(roleId: string): Promise<string[]> {
    const cached = this.cache.get(roleId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { module: true, action: true },
    });

    const permissions = rolePermissions.map((rp) => `${rp.module}:${rp.action}`);
    this.cache.set(roleId, { permissions, expiresAt: Date.now() + this.TTL_MS });
    return permissions;
  }

  invalidateRoleCache(roleId: string): void {
    this.cache.delete(roleId);
  }
}
