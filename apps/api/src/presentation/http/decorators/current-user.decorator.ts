import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JWTPayload } from '../../../application/ports/jwt.port';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JWTPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JWTPayload;
  },
);
