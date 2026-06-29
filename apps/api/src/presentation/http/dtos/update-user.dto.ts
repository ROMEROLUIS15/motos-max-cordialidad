export interface UpdateUserDto {
  fullName?: string;
  branchId?: string | null;
  isActive?: boolean;
  email?: string;
  password?: string;
}
