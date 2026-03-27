import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserEmail } from '../common/decorators/current-user-email.decorator';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'laruta-chat-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('secure')
  @UseGuards(JwtAuthGuard)
  secure(@CurrentUserEmail() email: string) {
    return {
      message: 'Ruta protegida OK',
      email,
    };
  }
}
