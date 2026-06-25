import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '../auth/jwt.service';

/**
 * WebSocket gateway for real-time notifications. On connect, the client must
 * provide a JWT (handshake auth.token); the socket then joins its user and
 * tenant rooms.
 */
@WebSocketGateway({ namespace: '/notifications', cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket): void {
    try {
      const token =
        (client.handshake.auth?.['token'] as string | undefined) ??
        (client.handshake.headers['authorization'] as string | undefined)?.replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);
      void client.join(`user:${payload.sub}`);
      void client.join(`tenant:${payload.tenantId}`);
    } catch {
      client.disconnect();
    }
  }

  emitToUser(userId: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit('notification', payload);
  }

  emitToTenant(tenantId: string, payload: unknown): void {
    this.server?.to(`tenant:${tenantId}`).emit('notification', payload);
  }
}
