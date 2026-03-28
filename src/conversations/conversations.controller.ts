import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserEmail } from '../common/decorators/current-user-email.decorator';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationsService } from './conversations.service';
import { Get } from '@nestjs/common';
import { Param, Query } from '@nestjs/common';
import { GetConversationMessagesDto } from '../messages/dto/get-conversation-messages.dto';

@Controller('chat/conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createConversation(
    @CurrentUserEmail() requesterEmail: string,
    @Body() body: CreateConversationDto,
  ) {
    return this.conversationsService.createOrGetConversation(
      requesterEmail,
      body.targetUserId,
    );
  }
  @Get()
  @UseGuards(JwtAuthGuard)
  async getConversations(@CurrentUserEmail() requesterEmail: string) {
    return this.conversationsService.getUserConversations(requesterEmail);
  }

  @Get(':conversationId/messages')
  @UseGuards(JwtAuthGuard)
  async getConversationMessages(
    @CurrentUserEmail() requesterEmail: string,
    @Param('conversationId') conversationId: string,
    @Query() query: GetConversationMessagesDto,
  ) {
    return this.conversationsService.getConversationMessages(
      requesterEmail,
      conversationId,
      query.page,
      query.limit,
    );
  }
}
