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

      const rutNorm = String(rut).trim().toUpperCase();
      const dvNorm = String(dv).trim().toUpperCase();
      if (!/^[0-9K]+$/.test(rutNorm) || rutNorm.length > 12) {
        res.status(400).json({ message: 'RUT inválido: solo números y K, máximo 12 caracteres' });
        return;
      }
      if (!/^[0-9K]$/.test(dvNorm)) {
        res.status(400).json({ message: 'DV inválido: solo números y K (1 carácter)' });
        return;
      }

      if (String(password).length < 6 || String(password).length > 72) {
        res.status(400).json({ message: 'La contraseña debe tener entre 6 y 72 caracteres' });
        return;
      }

      if (String(nombres).length > 100) { res.status(400).json({ message: 'Nombres máximo 100 caracteres' }); return; }
      if (String(apellido_paterno).length > 100) { res.status(400).json({ message: 'Apellido paterno máximo 100 caracteres' }); return; }
      if (apellido_materno && String(apellido_materno).length > 100) { res.status(400).json({ message: 'Apellido materno máximo 100 caracteres' }); return; }
      if (titulo && String(titulo).length > 100) { res.status(400).json({ message: 'Título máximo 100 caracteres' }); return; }
      if (String(cargo).length > 100) { res.status(400).json({ message: 'Cargo máximo 100 caracteres' }); return; }
      if (String(email).length > 255) { res.status(400).json({ message: 'Email máximo 255 caracteres' }); return; }
      if (String(username).length > 50) { res.status(400).json({ message: 'Username máximo 50 caracteres' }); return; }

      const password_hash = await bcrypt.hash(password, 10);
      const user = await userRepository.create({
        nombres, rut: rutNorm, dv: dvNorm, apellido_paterno, apellido_materno, titulo, cargo, email, username, password_hash, rol_id, can_change_password,
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

      if (data.rut !== undefined) {
        const rutNorm = String(data.rut).trim().toUpperCase();
        if (!/^[0-9K]+$/.test(rutNorm) || rutNorm.length > 12) {
          res.status(400).json({ message: 'RUT inválido: solo números y K, máximo 12 caracteres' });
          return;
        }
        data.rut = rutNorm;
      }
      if (data.dv !== undefined) {
        const dvNorm = String(data.dv).trim().toUpperCase();
        if (!/^[0-9K]$/.test(dvNorm)) {
          res.status(400).json({ message: 'DV inválido: solo números y K (1 carácter)' });
          return;
        }
        data.dv = dvNorm;
      }

      const lenCheck: Record<string, number> = { nombres: 100, apellido_paterno: 100, apellido_materno: 100, titulo: 100, cargo: 100, email: 255, username: 50 };
      for (const [field, max] of Object.entries(lenCheck)) {
        if (data[field] !== undefined && data[field] !== null && String(data[field]).length > max) {
          res.status(400).json({ message: `${field} máximo ${max} caracteres` });
          return;
        }
      }

      if (data.password) {
        if (String(data.password).length < 6 || String(data.password).length > 72) {
          res.status(400).json({ message: 'La contraseña debe tener entre 6 y 72 caracteres' });
          return;
        }
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

      if (!password || password.length < 6 || password.length > 72) {
        res.status(400).json({ message: 'La contraseña debe tener entre 6 y 72 caracteres' });
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

  async verify2FA(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ message: 'Código requerido' });
        return;
      }

      const user = await userRepository.findById(id);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }

      const result = await authService.verify2FA(id, token);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Error al verificar 2FA' });
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
