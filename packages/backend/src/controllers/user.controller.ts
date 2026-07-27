import { Request, Response } from 'express';
import { userRepository } from '../repositories/user.repository';
import bcrypt from 'bcryptjs';

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
      const { nombres, rut, dv, apellido_paterno, apellido_materno, titulo, cargo, email, username, password, rol_id } = req.body;

      if (!nombres || !rut || !dv || !apellido_paterno || !cargo || !email || !username || !password || !rol_id) {
        res.status(400).json({ message: 'Campos requeridos faltantes' });
        return;
      }

      const password_hash = await bcrypt.hash(password, 10);
      const user = await userRepository.create({
        nombres, rut, dv, apellido_paterno, apellido_materno, titulo, cargo, email, username, password_hash, rol_id,
      } as any);

      const { password_hash: _, ...result } = user;
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
        delete data.password;
      }

      const user = await userRepository.update(id, data);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      const { password_hash, ...rest } = user;
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
      res.json({ message: suspended ? 'Usuario suspendido' : 'Usuario activado' });
    } catch (error) {
      res.status(500).json({ message: 'Error al suspender/activar usuario' });
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
      res.json({ message: 'Usuario eliminado' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar usuario' });
    }
  },
};
