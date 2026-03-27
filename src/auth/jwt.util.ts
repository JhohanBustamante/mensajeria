import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import { JwtPayload as AppJwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtUtil {
  constructor(private readonly configService: ConfigService) {}

  verifyToken(token: string): AppJwtPayload {
    const secret = this.configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET no definido');
    }

    try {
      const signingKey = Buffer.from(secret, 'base64');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const decodedUnknown: unknown = verify(token, signingKey);

      if (
        typeof decodedUnknown !== 'object' ||
        decodedUnknown === null ||
        !('sub' in decodedUnknown) ||
        typeof decodedUnknown.sub !== 'string'
      ) {
        throw new UnauthorizedException('Payload de token inválido');
      }

      const decoded = decodedUnknown as {
        sub: string;
        iat?: number;
        exp?: number;
      };

      return {
        sub: decoded.sub,
        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch (error) {
      console.error('JWT verify error:', error);
      throw new UnauthorizedException('Token inválido');
    }
  }
}
