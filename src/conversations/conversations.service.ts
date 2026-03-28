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
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Message, MessageDocument } from '../messages/schemas/message.schema';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
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

  async getUserConversations(
    requesterEmail: string,
  ): Promise<ConversationResponse[]> {
    const conversations = await this.conversationModel
      .find({ participantsEmails: requesterEmail })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .exec();

    const results: ConversationResponse[] = [];

    for (const conversation of conversations) {
      const requesterIndex = conversation.participantsEmails.findIndex(
        (email) => email === requesterEmail,
      );

      if (requesterIndex === -1) {
        continue;
      }

      const otherIndex = requesterIndex === 0 ? 1 : 0;
      const targetUserId = conversation.participantsUserIds[otherIndex];

      const eligibility = await this.mainApiService.checkChatEligibility({
        requesterEmail,
        targetUserId,
      });

      const shouldBeBlocked = !eligibility.allowed;

      if (conversation.blocked !== shouldBeBlocked) {
        conversation.blocked = shouldBeBlocked;
        conversation.blockedReason = shouldBeBlocked
          ? 'Los usuarios ya no comparten comunidad'
          : null;

        await conversation.save();
      }

      results.push({
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
      });
    }

    return results;
  }

  async getConversationMessages(
    requesterEmail: string,
    conversationId: string,
    page: number,
    limit: number,
  ) {
    const conversation = await this.conversationModel.findById(conversationId);

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    const isParticipant =
      conversation.participantsEmails.includes(requesterEmail);

    if (!isParticipant) {
      throw new ForbiddenException('No perteneces a esta conversación');
    }

    const skip = (page - 1) * limit;

    const messages = await this.messageModel
      .find({ conversationId: conversation._id })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.messageModel.countDocuments({
      conversationId: conversation._id,
    });

    return {
      items: messages.map((message) => ({
        id: message._id.toString(),
        conversationId: message.conversationId.toString(),
        senderUserId: message.senderUserId,
        senderEmail: message.senderEmail,
        senderUsername: message.senderUsername,
        content: message.content,
        sentAt: message.sentAt,
      })),
      page,
      limit,
      hasMore: skip + messages.length < total,
    };
  }

  async sendMessage(
    requesterEmail: string,
    conversationId: string,
    content: string,
  ) {
    const conversation = await this.conversationModel.findById(conversationId);

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    const requesterIndex = conversation.participantsEmails.findIndex(
      (email) => email === requesterEmail,
    );

    if (requesterIndex === -1) {
      throw new ForbiddenException('No perteneces a esta conversación');
    }

    const otherIndex = requesterIndex === 0 ? 1 : 0;
    const targetUserId = conversation.participantsUserIds[otherIndex];

    const eligibility = await this.mainApiService.checkChatEligibility({
      requesterEmail,
      targetUserId,
    });

    if (!eligibility.allowed) {
      conversation.blocked = true;
      conversation.blockedReason = 'Los usuarios ya no comparten comunidad';
      await conversation.save();

      throw new BadRequestException('CHAT_BLOCKED');
    }

    const senderUser = eligibility.requesterUser;

    const message = await this.messageModel.create({
      conversationId: conversation._id,
      senderUserId: senderUser.userId,
      senderEmail: senderUser.email,
      senderUsername: senderUser.username,
      content,
      sentAt: new Date(),
    });

    conversation.blocked = false;
    conversation.blockedReason = null;
    conversation.lastMessage = content;
    conversation.lastMessageAt = message.sentAt;
    await conversation.save();

    return {
      id: message._id.toString(),
      conversationId: conversation._id.toString(),
      senderUserId: message.senderUserId,
      senderEmail: message.senderEmail,
      senderUsername: message.senderUsername,
      content: message.content,
      sentAt: message.sentAt,
      recipientEmail: conversation.participantsEmails[otherIndex],
    };
  }
}
