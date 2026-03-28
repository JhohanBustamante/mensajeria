import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MainApiModule } from '../integrations/main-api/main-api.module';
import { MessagesModule } from '../messages/messages.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AuthModule, ConversationsModule, MessagesModule, MainApiModule],
  providers: [ChatGateway],
})
export class ChatModule {}
