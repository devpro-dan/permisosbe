import { Request, Response } from 'express';
import { roleRepository } from '../repositories/role.repository';

export const roleController = {
  async list(_req: Request, res: Response) {
    try {
      const roles = await roleRepository.findAll();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener roles' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const role = await roleRepository.findById(parseInt(req.params.id));
      if (!role) {
        res.status(404).json({ message: 'Rol no encontrado' });
        return;
      }
      const permissions = await roleRepository.getPermissions(role.id);
      res.json({ ...role, permissions });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener rol' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { nombre, descripcion } = req.body;
      if (!nombre) {
        res.status(400).json({ message: 'Nombre del rol requerido' });
        return;
      }
      const role = await roleRepository.create(nombre, descripcion);
      res.status(201).json(role);
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(400).json({ message: 'El nombre del rol ya existe' });
        return;
      }
      res.status(500).json({ message: 'Error al crear rol' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nombre, descripcion } = req.body;
      if (!nombre) {
        res.status(400).json({ message: 'Nombre del rol requerido' });
        return;
      }
      const role = await roleRepository.update(id, nombre, descripcion);
      if (!role) {
        res.status(404).json({ message: 'Rol no encontrado' });
        return;
      }
      res.json(role);
    } catch (error) {
      res.status(500).json({ message: 'Error al actualizar rol' });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const deleted = await roleRepository.delete(id);
      if (!deleted) {
        res.status(404).json({ message: 'Rol no encontrado' });
        return;
      }
      res.json({ message: 'Rol eliminado' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar rol' });
    }
  },

  async getPermissions(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permissions = await roleRepository.getPermissions(id);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener permisos' });
    }
  },

  async setPermission(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { seccion, can_view, can_create, can_edit, can_delete } = req.body;
      if (!seccion) {
        res.status(400).json({ message: 'Sección requerida' });
        return;
      }
      const perm = await roleRepository.setPermission(id, seccion, { can_view, can_create, can_edit, can_delete });
      res.json(perm);
    } catch (error) {
      res.status(500).json({ message: 'Error al configurar permiso' });
    }
  },
};
