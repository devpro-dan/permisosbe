import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types';
import { sessionRepository } from '../repositories/session.repository';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ message: 'Token de autenticación requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Token de autenticación requerido' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    
    const session = await sessionRepository.findByToken(token);
    if (!session) {
      res.status(401).json({ message: 'Sesión no válida o cerrada', code: 'SESSION_CLOSED' });
      return;
    }

    if (new Date() > new Date(session.expires_at)) {
      await sessionRepository.deleteById(session.id);
      res.status(401).json({ message: 'Sesión expirada', code: 'SESSION_EXPIRED' });
      return;
    }

    await sessionRepository.updateActivity(session.id);
    
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
};
