import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { WebSocket } from 'ws';
import { JwtUtil } from '../auth/jwt.util';
import { ConversationsService } from '../conversations/conversations.service';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthenticatedSocket extends WebSocket {
  userEmail?: string;
}

@WebSocketGateway({
  path: '/ws/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private clients = new Map<string, Set<AuthenticatedSocket>>();

  constructor(
    private readonly jwtUtil: JwtUtil,
    private readonly conversationsService: ConversationsService,
  ) {}

  handleConnection(client: AuthenticatedSocket, request: Request) {
    try {
      const url = new URL(request.url || '', 'http://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        client.close();
        return;
      }

      const payload = this.jwtUtil.verifyToken(token);
      client.userEmail = payload.sub;

      const userClients =
        this.clients.get(payload.sub) || new Set<AuthenticatedSocket>();
      userClients.add(client);
      this.clients.set(payload.sub, userClients);
    } catch {
      client.close();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (!client.userEmail) {
      return;
    }

    const userClients = this.clients.get(client.userEmail);

    if (!userClients) {
      return;
    }

    userClients.delete(client);

    if (userClients.size === 0) {
      this.clients.delete(client.userEmail);
    }
  }

  @SubscribeMessage('message')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { type: string; payload: SendMessageDto },
  ) {
    if (!client.userEmail) {
      client.send(
        JSON.stringify({
          type: 'ERROR',
          payload: { message: 'No autenticado' },
        }),
      );
      return;
    }

    if (body.type !== 'SEND_MESSAGE') {
      client.send(
        JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Tipo de mensaje no soportado' },
        }),
      );
      return;
    }

    try {
      const result = await this.conversationsService.sendMessage(
        client.userEmail,
        body.payload.conversationId,
        body.payload.content,
      );

      const response = {
        type: 'NEW_MESSAGE',
        payload: {
          id: result.id,
          conversationId: result.conversationId,
          senderUserId: result.senderUserId,
          senderEmail: result.senderEmail,
          senderUsername: result.senderUsername,
          content: result.content,
          sentAt: result.sentAt,
        },
      };

      client.send(JSON.stringify(response));

      const recipientSockets = this.clients.get(result.recipientEmail);

      if (recipientSockets) {
        for (const recipientSocket of recipientSockets) {
          recipientSocket.send(JSON.stringify(response));
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error enviando mensaje';

      if (message === 'CHAT_BLOCKED') {
        client.send(
          JSON.stringify({
            type: 'CHAT_BLOCKED',
            payload: {
              conversationId: body.payload.conversationId,
              reason: 'Los usuarios ya no comparten comunidad',
            },
          }),
        );
        return;
      }

      client.send(
        JSON.stringify({
          type: 'ERROR',
          payload: { message },
        }),
      );
    }
  }
}
