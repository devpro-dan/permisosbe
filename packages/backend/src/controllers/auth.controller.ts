import { Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../config/database';
import bcrypt from 'bcryptjs';
import { authService } from '../services/auth.service';
import { userRepository } from '../repositories/user.repository';
import { emailService } from '../services/email.service';
import { env } from '../config/env';

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
      const user = await userRepository.findById(req.user!.userId);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      const { password_hash, rol_id, ...rest } = user;
      res.json({ ...rest, rolId: rol_id });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener perfil' });
    }
  },

  async changeMyPassword(req: Request, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.userId;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ message: 'Contraseña actual y nueva son requeridas' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
        return;
      }

      const user = await userRepository.findById(userId);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }

      if (!user.can_change_password) {
        res.status(403).json({ message: 'No tienes permiso para cambiar tu contraseña. Contacta al administrador.' });
        return;
      }

      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        res.status(400).json({ message: 'Contraseña actual incorrecta' });
        return;
      }

      const password_hash = await bcrypt.hash(newPassword, 10);
      await userRepository.update(userId, { password_hash } as any);

      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (error) {
      res.status(500).json({ message: 'Error al cambiar contraseña' });
    }
  },

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ message: 'Email es requerido' });
        return;
      }

      let user = await userRepository.findByEmail(email);
      if (!user) {
        user = await userRepository.findByUsername(email);
      }
      if (!user) {
        res.json({ message: 'Si el email está registrado y tiene habilitado el cambio de contraseña, recibirás un enlace de restablecimiento.' });
        return;
      }

      if (!user.can_change_password) {
        res.status(403).json({ message: 'No tienes permiso para cambiar tu contraseña. Contacta al administrador.' });
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, token, expiresAt]
      );

      const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}`;

      console.log('🔗 Enlace de restablecimiento:', resetLink);

      await emailService.sendResetPasswordEmail(
        user.email,
        `${user.nombres} ${user.apellido_paterno}`,
        resetLink
      );

      res.json({ message: 'Si el email está registrado y tiene habilitado el cambio de contraseña, recibirás un enlace de restablecimiento.' });
    } catch (error: any) {
      console.error('Error en forgotPassword:', error.message || error);
      res.status(500).json({ message: error.message || 'Error al procesar la solicitud' });
    }
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({ message: 'Token y nueva contraseña son requeridos' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
        return;
      }

      const result = await pool.query(
        'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > NOW()',
        [token]
      );

      if (result.rows.length === 0) {
        res.status(400).json({ message: 'Token inválido o expirado' });
        return;
      }

      const resetToken = result.rows[0];
      const password_hash = await bcrypt.hash(newPassword, 10);

      await userRepository.update(resetToken.user_id, { password_hash } as any);
      await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);

      res.json({ message: 'Contraseña restablecida correctamente. Ahora puedes iniciar sesión.' });
    } catch (error) {
      res.status(500).json({ message: 'Error al restablecer contraseña' });
    }
  },
};
