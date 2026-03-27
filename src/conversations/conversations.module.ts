import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { MainApiModule } from '../integrations/main-api/main-api.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
    ]),
    MainApiModule,
    AuthModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [MongooseModule, ConversationsService],
})
export class ConversationsModule {}
