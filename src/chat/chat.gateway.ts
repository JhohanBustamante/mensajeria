import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { IncomingMessage } from 'http';
import WebSocket, { RawData } from 'ws';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { JwtUtil } from '../auth/jwt.util';
import { ConversationsService } from '../conversations/conversations.service';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthenticatedSocket extends WebSocket {
  userEmail?: string;
}

interface IncomingWsMessage {
  type: string;
  payload: SendMessageDto;
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

  handleConnection(client: AuthenticatedSocket, request: IncomingMessage) {
    try {
      console.log('WS request.url:', request.url);

      const url = new URL(request.url ?? '', 'http://localhost');
      const rawToken = url.searchParams.get('token');

      console.log('WS token recibido:', rawToken);

      if (!rawToken) {
        client.close(1008, 'Token no proporcionado');
        return;
      }

      const token = rawToken.trim().replace(/^Bearer\s+/i, '');
      const payload = this.jwtUtil.verifyToken(token);

      client.userEmail = payload.sub;

      const userClients =
        this.clients.get(payload.sub) ?? new Set<AuthenticatedSocket>();

      userClients.add(client);
      this.clients.set(payload.sub, userClients);

      console.log('WS autenticado:', payload.sub);

      client.on('message', (data: RawData) => {
        void this.handleRawMessage(client, data);
      });

      client.on('error', (error: Error) => {
        console.error('WS client error:', error.message);
      });
    } catch (error) {
      console.error('Error en handleConnection:', error);
      client.close(1008, 'No autorizado');
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

  private async handleRawMessage(client: AuthenticatedSocket, data: RawData) {
    if (!client.userEmail) {
      client.send(
        JSON.stringify({
          type: 'ERROR',
          payload: { message: 'No autenticado' },
        }),
      );
      return;
    }

    try {
      const text =
        typeof data === 'string'
          ? data
          : Buffer.isBuffer(data)
            ? data.toString('utf8')
            : Array.isArray(data)
              ? Buffer.concat(data).toString('utf8')
              : Buffer.from(data).toString('utf8');

      console.log('Mensaje WS recibido:', text);

      const parsed: unknown = JSON.parse(text);

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('type' in parsed) ||
        !('payload' in parsed)
      ) {
        client.send(
          JSON.stringify({
            type: 'ERROR',
            payload: { message: 'Estructura de mensaje inválida' },
          }),
        );
        return;
      }

      const body = parsed as IncomingWsMessage;

      if (body.type !== 'SEND_MESSAGE') {
        client.send(
          JSON.stringify({
            type: 'ERROR',
            payload: { message: 'Tipo de mensaje no soportado' },
          }),
        );
        return;
      }

      const payloadDto = plainToInstance(SendMessageDto, body.payload);
      const errors = await validate(payloadDto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (errors.length > 0) {
        client.send(
          JSON.stringify({
            type: 'ERROR',
            payload: {
              message: 'Payload inválido',
              errors: errors.map((error) => ({
                field: error.property,
                constraints: error.constraints ?? {},
              })),
            },
          }),
        );
        return;
      }

      const result = await this.conversationsService.sendMessage(
        client.userEmail,
        payloadDto.conversationId,
        payloadDto.content,
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
          if (
            recipientSocket !== client &&
            recipientSocket.readyState === WebSocket.OPEN
          ) {
            recipientSocket.send(JSON.stringify(response));
          }
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
