import { Module } from '@nestjs/common';
import { JwtUtil } from './jwt.util';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  providers: [JwtUtil, JwtAuthGuard],
  exports: [JwtUtil, JwtAuthGuard],
})
export class AuthModule {}
