import { Request, Response } from 'express';
import { sessionRepository } from '../repositories/session.repository';

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
      await sessionRepository.deleteAll();
      res.json({ message: 'Todas las sesiones han sido cerradas' });
    } catch (error) {
      res.status(500).json({ message: 'Error al cerrar sesiones' });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const deleted = await sessionRepository.deleteById(id);
      if (!deleted) {
        res.status(404).json({ message: 'Sesión no encontrada' });
        return;
      }
      res.json({ message: 'Sesión eliminada' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar sesión' });
    }
  },
};
