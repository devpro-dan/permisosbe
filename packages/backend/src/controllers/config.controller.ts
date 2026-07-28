import { Request, Response } from 'express';
import { systemConfigRepository } from '../repositories/systemConfig.repository';
import { emailService } from '../services/email.service';

const SENSITIVE_KEYS = ['smtp_pass'];

function maskSensitive(config: any) {
  if (SENSITIVE_KEYS.includes(config.clave)) {
    config.valor = '';
  }
  return config;
}

export const configController = {
  async list(_req: Request, res: Response) {
    try {
      const configs = await systemConfigRepository.findAll();
      res.json(configs.map(maskSensitive));
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
      res.json(maskSensitive(config));
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

      if (SENSITIVE_KEYS.includes(clave) && !valor) {
        const existing = await systemConfigRepository.findByClave(clave);
        if (existing) {
          return res.json(maskSensitive(existing));
        }
      }

      const config = await systemConfigRepository.set(clave, valor, descripcion);
      res.json(maskSensitive(config));
    } catch (error) {
      res.status(500).json({ message: 'Error al guardar configuración' });
    }
  },

  async testEmail(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ message: 'El correo de destino es requerido' });
        return;
      }

      await emailService.sendTestEmail(email.trim());
      res.json({ message: `Correo de prueba enviado a ${email.trim()}` });
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'No se pudo enviar el correo de prueba' });
    }
  },
};
