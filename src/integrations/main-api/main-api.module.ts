import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MainApiService } from './main-api.service';

@Module({
  imports: [HttpModule],
  providers: [MainApiService],
  exports: [MainApiService],
})
export class MainApiModule {}
