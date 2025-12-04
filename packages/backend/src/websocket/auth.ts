import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
  tenantType?: string;
  userRole?: string;
}

export async function authenticateSocket(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next(new Error('JWT_SECRET not configured'));
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      tenantId: string;
      role: string;
      tenantType: string;
    };

    socket.userId = decoded.userId;
    socket.tenantId = decoded.tenantId;
    socket.tenantType = decoded.tenantType;
    socket.userRole = decoded.role;

    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
}













