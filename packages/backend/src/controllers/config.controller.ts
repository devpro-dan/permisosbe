import { Request, Response } from 'express';
import { systemConfigRepository } from '../repositories/systemConfig.repository';

export const configController = {
  async list(_req: Request, res: Response) {
    try {
      const configs = await systemConfigRepository.findAll();
      res.json(configs);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener configuraciones' });
    }
  },

  async getByClave(req: Request, res: Response) {
    try {
      const config = await systemConfigRepository.findByClave(req.params.clave);
      if (!config) {
        res.status(404).json({ message: 'Configuración no encontrada' });
        return;
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener configuración' });
    }
  },

  async set(req: Request, res: Response) {
    try {
      const { clave, valor, descripcion } = req.body;
      if (!clave || valor === undefined) {
        res.status(400).json({ message: 'Clave y valor requeridos' });
        return;
      }
      const config = await systemConfigRepository.set(clave, valor, descripcion);
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: 'Error al guardar configuración' });
    }
  },
};
