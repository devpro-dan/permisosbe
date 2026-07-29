import { Request, Response } from 'express';
import { userRepository } from '../repositories/user.repository';
import bcrypt from 'bcryptjs';
import pool from '../config/database';
import { authService } from '../services/auth.service';
import { auditLogService } from '../services/auditLog.service';

export const userController = {
  async list(_req: Request, res: Response) {
    try {
      const users = await userRepository.findAll();
      const sanitized = users.map((u: any) => {
        const { password_hash, ...rest } = u;
        return rest;
      });
      res.json(sanitized);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener usuarios' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const user = await userRepository.findById(parseInt(req.params.id));
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      const { password_hash, ...rest } = user;
      res.json(rest);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener usuario' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { nombres, rut, dv, apellido_paterno, apellido_materno, titulo, cargo, email, username, password, rol_id, can_change_password } = req.body;

      if (!nombres || !rut || !dv || !apellido_paterno || !cargo || !email || !username || !password || !rol_id) {
        res.status(400).json({ message: 'Campos requeridos faltantes' });
        return;
      }

      const password_hash = await bcrypt.hash(password, 10);
      const user = await userRepository.create({
        nombres, rut, dv, apellido_paterno, apellido_materno, titulo, cargo, email, username, password_hash, rol_id, can_change_password,
      } as any);

      const { password_hash: _, ...result } = user;
      await auditLogService.register(req, 'create', 'usuario', user.id, `Creó usuario: ${nombres} ${apellido_paterno} (${username})`);
      res.status(201).json(result);
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(400).json({ message: 'El username o email ya existe' });
        return;
      }
      res.status(500).json({ message: 'Error al crear usuario' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;

      if (data.password) {
        data.password_hash = await bcrypt.hash(data.password, 10);
      }
      delete data.password;

      const user = await userRepository.update(id, data);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      const { password_hash, ...rest } = user;
      await auditLogService.register(req, 'update', 'usuario', id, `Editó usuario #${id}`);
      res.json(rest);
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar usuario' });
    }
  },

  async suspend(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { suspended } = req.body;
      const user = await userRepository.updateSuspension(id, suspended);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      await auditLogService.register(req, suspended ? 'suspend' : 'activate', 'usuario', id, `${suspended ? 'Suspendió' : 'Activó'} usuario #${id}`);
      res.json({ message: suspended ? 'Usuario suspendido' : 'Usuario activado' });
    } catch (error) {
      res.status(500).json({ message: 'Error al suspender/activar usuario' });
    }
  },

  async changePassword(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { password } = req.body;

      if (!password || password.length < 6) {
        res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
        return;
      }

      const password_hash = await bcrypt.hash(password, 10);
      const user = await userRepository.update(id, { password_hash } as any);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }

      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (error) {
      res.status(500).json({ message: 'Error al cambiar contraseña' });
    }
  },

  async setup2FA(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const user = await userRepository.findById(id);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }

      const result = await authService.setup2FA(id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Error al configurar 2FA' });
    }
  },

  async disable2FA(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await pool.query('DELETE FROM user_2fa WHERE user_id = $1', [id]);
      res.json({ message: '2FA desactivado correctamente' });
    } catch (error) {
      res.status(500).json({ message: 'Error al desactivar 2FA' });
    }
  },

  async get2FAStatus(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const result = await pool.query(
        'SELECT enabled FROM user_2fa WHERE user_id = $1',
        [id]
      );
      res.json({ enabled: result.rows.length > 0 && result.rows[0].enabled });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener estado 2FA' });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const deleted = await userRepository.delete(id);
      if (!deleted) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      await auditLogService.register(req, 'delete', 'usuario', id, `Eliminó usuario #${id}`);
      res.json({ message: 'Usuario eliminado' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar usuario' });
    }
  },
};
