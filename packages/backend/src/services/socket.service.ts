import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types';

let io: SocketIOServer;
const userSockets = new Map<number, Set<string>>();

export function initializeSocket(server: HttpServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: env.URL_CLIENT.split(',').map((origin) => origin.trim()).filter(Boolean),
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      socket.disconnect();
      return;
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const userId = decoded.userId;

      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(socket.id);

      console.log(`Usuario ${userId} conectado (socket: ${socket.id})`);

      socket.on('disconnect', () => {
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
          }
        }
        console.log(`Usuario ${userId} desconectado (socket: ${socket.id})`);
      });
    } catch (error) {
      socket.disconnect();
    }
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO no ha sido inicializado');
  }
  return io;
}

export function emitToUser(userId: number, event: string, data: any) {
  const sockets = userSockets.get(userId);
  if (sockets && sockets.size > 0) {
    sockets.forEach((socketId) => {
      io.to(socketId).emit(event, data);
    });
    console.log(`Evento "${event}" enviado a usuario ${userId} (${sockets.size} conexiones)`);
  }
}

export function emitToAll(event: string, data: any) {
  io.emit(event, data);
  console.log(`Evento "${event}" enviado a todos los usuarios`);
}
