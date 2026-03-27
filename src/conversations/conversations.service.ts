import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MainApiService } from '../integrations/main-api/main-api.service';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { ConversationResponse } from './interfaces/conversation-response.interface';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    private readonly mainApiService: MainApiService,
  ) {}

  async createOrGetConversation(
    requesterEmail: string,
    targetUserId: number,
  ): Promise<ConversationResponse> {
    const eligibility = await this.mainApiService.checkChatEligibility({
      requesterEmail,
      targetUserId,
    });

    if (!eligibility.allowed) {
      throw new BadRequestException(
        'No está permitido crear un chat entre estos usuarios',
      );
    }

    const requester = eligibility.requesterUser;
    const target = eligibility.targetUser;

    if (requester.userId === target.userId) {
      throw new BadRequestException(
        'No puedes crear una conversación contigo mismo',
      );
    }

    const orderedParticipants = [
      {
        userId: requester.userId,
        email: requester.email,
        username: requester.username,
      },
      {
        userId: target.userId,
        email: target.email,
        username: target.username,
      },
    ].sort((a, b) => a.userId - b.userId);

    const conversationKey = `${orderedParticipants[0].userId}:${orderedParticipants[1].userId}`;

    let conversation = await this.conversationModel.findOne({
      conversationKey,
    });

    if (!conversation) {
      try {
        conversation = await this.conversationModel.create({
          conversationKey,
          participantsUserIds: orderedParticipants.map((p) => p.userId),
          participantsEmails: orderedParticipants.map((p) => p.email),
          participantsUsernames: orderedParticipants.map((p) => p.username),
          blocked: false,
          blockedReason: null,
          lastMessage: null,
          lastMessageAt: null,
        });
      } catch (error) {
        console.error('Conversation create error:', error);
        throw new InternalServerErrorException(
          'No fue posible crear la conversación',
        );
      }
    }

    const requesterIndex = conversation.participantsEmails.findIndex(
      (email) => email === requesterEmail,
    );

    if (requesterIndex === -1) {
      throw new BadRequestException(
        'El usuario autenticado no pertenece a esta conversación',
      );
    }

    const otherIndex = requesterIndex === 0 ? 1 : 0;

    return {
      id: conversation._id.toString(),
      otherUser: {
        userId: conversation.participantsUserIds[otherIndex],
        email: conversation.participantsEmails[otherIndex],
        username: conversation.participantsUsernames[otherIndex],
      },
      blocked: conversation.blocked,
      blockedReason: conversation.blockedReason,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }
}
