import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { JwtUtil } from '../jwt.util';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtUtil: JwtUtil) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No se encontró Authorization header');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Formato de token inválido');
    }

    const payload: JwtPayload = this.jwtUtil.verifyToken(token);

    (request as RequestWithUser).user = payload;

    return true;
  }
}
