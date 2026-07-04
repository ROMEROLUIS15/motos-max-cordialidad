import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  roleId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/[A-Z]/, { message: 'Debe contener al menos una letra mayúscula' })
  @Matches(/[a-z]/, { message: 'Debe contener al menos una letra minúscula' })
  @Matches(/[0-9]/, { message: 'Debe contener al menos un número' })
  password!: string;

  @IsString()
  fullName!: string;
}
