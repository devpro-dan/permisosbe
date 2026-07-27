import { Request, Response } from 'express';
import pool from '../config/database';
import { authService } from '../services/auth.service';

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { username, password, twoFactorToken } = req.body;

      if (!username || !password) {
        res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
        return;
      }

      const result = await authService.login(username, password);

      if (twoFactorToken) {
        const valid = await authService.validate2FA(result.user.id, twoFactorToken);
        if (!valid) {
          res.status(401).json({ message: 'Código 2FA inválido' });
          return;
        }
      } else {
        const twoFactorResult = await pool.query(
          'SELECT enabled FROM user_2fa WHERE user_id = $1',
          [result.user.id]
        );
        if (twoFactorResult.rows.length > 0 && twoFactorResult.rows[0].enabled) {
          res.json({ requires2FA: true, userId: result.user.id });
          return;
        }
      }

      res.json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message || 'Error de autenticación' });
    }
  },

  async setup2FA(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await authService.setup2FA(userId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Error al configurar 2FA' });
    }
  },

  async verify2FA(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ message: 'Token requerido' });
        return;
      }

      const result = await authService.verify2FA(userId, token);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Error al verificar 2FA' });
    }
  },

  async refreshToken(req: Request, res: Response) {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ message: 'Token requerido' });
        return;
      }
      const result = await authService.refreshToken(token);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message || 'Error al refrescar token' });
    }
  },

  async getProfile(req: Request, res: Response) {
    try {
      const { userRepository } = require('../repositories/user.repository');
      const user = await userRepository.findById(req.user!.userId);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      const { password_hash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener perfil' });
    }
  },
};
