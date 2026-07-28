import { Request, Response } from 'express';
import { sessionRepository } from '../repositories/session.repository';
import { emitToUser, emitToAll } from '../services/socket.service';

export const sessionController = {
  async list(_req: Request, res: Response) {
    try {
      const sessions = await sessionRepository.findAll();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener sesiones' });
    }
  },

  async removeAll(_req: Request, res: Response) {
    try {
      const sessions = await sessionRepository.findAll();
      await sessionRepository.deleteAll();
      
      emitToAll('session:closed', { 
        message: 'Tu sesión ha sido cerrada por un administrador',
        reason: 'all_sessions_closed'
      });
      
      res.json({ message: 'Todas las sesiones han sido cerradas' });
    } catch (error) {
      res.status(500).json({ message: 'Error al cerrar sesiones' });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      const sessions = await sessionRepository.findAll();
      const session = sessions.find(s => s.id === id);
      
      if (!session) {
        res.status(404).json({ message: 'Sesión no encontrada' });
        return;
      }
      
      const deleted = await sessionRepository.deleteById(id);
      if (!deleted) {
        res.status(404).json({ message: 'Sesión no encontrada' });
        return;
      }
      
      emitToUser(session.user_id, 'session:closed', {
        message: 'Tu sesión ha sido cerrada por un administrador',
        reason: 'session_deleted'
      });
      
      res.json({ message: 'Sesión eliminada' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar sesión' });
    }
  },
};
