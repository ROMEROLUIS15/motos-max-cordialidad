export class User {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public branchId: string | null,
    public roleId: string,
    public readonly email: string,
    public passwordHash: string,
    public fullName: string,
    public isActive: boolean,
    public lastLoginAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  updateLastLogin(): void {
    this.lastLoginAt = new Date();
    this.updatedAt = new Date();
  }

  assignRole(roleId: string): void {
    this.roleId = roleId;
    this.updatedAt = new Date();
  }
}
