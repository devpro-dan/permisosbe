import { io, Socket } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

let socket: Socket | null = null;

export function connectSocket(token: string) {
  if (socket?.connected) {
    return socket;
  }

  socket = io(apiUrl, {
    auth: {
      token,
    },
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('Socket.IO conectado');
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO desconectado');
  });

  socket.on('connect_error', (error) => {
    console.error('Error de conexión Socket.IO:', error.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function onSessionClosed(callback: (data: any) => void) {
  if (socket) {
    socket.on('session:closed', callback);
  }
}

export function offSessionClosed(callback: (data: any) => void) {
  if (socket) {
    socket.off('session:closed', callback);
  }
}
