import { Request, Response } from 'express';
import { permisoService } from '../services/permiso.service';
import { emailService } from '../services/email.service';

export const permisoController = {
  async misPermisos(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const permisos = await permisoService.findByUser(userId);
      const disponibilidad = await permisoService.getAvailablePermisos(userId);
      res.json({ permisos, disponibilidad });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener permisos' });
    }
  },

  async solicitar(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { fecha_inicio, fecha_fin, tipo_jornada, motivo } = req.body;

      if (!fecha_inicio || !tipo_jornada || !motivo) {
        res.status(400).json({ message: 'Fecha inicio, tipo jornada y motivo son requeridos' });
        return;
      }

      if (!['completa', 'media'].includes(tipo_jornada)) {
        res.status(400).json({ message: 'Tipo jornada debe ser completa o media' });
        return;
      }

      const disponibilidad = await permisoService.getAvailablePermisos(userId);
      if (disponibilidad.available <= 0) {
        res.status(400).json({ message: 'No tienes permisos disponibles para este año' });
        return;
      }

      const overlap = await permisoService.checkOverlap(userId, fecha_inicio, fecha_fin);
      if (overlap) {
        res.status(400).json({ message: 'Ya tienes un permiso registrado para esa fecha' });
        return;
      }

      const permiso = await permisoService.create({
        user_id: userId, fecha_inicio, fecha_fin, tipo_jornada, motivo,
      });

      const { userRepository } = require('../repositories/user.repository');
      const user = await userRepository.findById(userId);
      if (user?.email) {
        await emailService.sendPermisoNotification(user.email, 'solicitado', permiso);
      }

      res.status(201).json(permiso);
    } catch (error) {
      res.status(500).json({ message: 'Error al solicitar permiso' });
    }
  },

  async listarTodos(req: Request, res: Response) {
    try {
      const permisos = await permisoService.findAll();
      res.json(permisos);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener permisos' });
    }
  },

  async getByUserId(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.userId);
      const permisos = await permisoService.findByUserId(userId);
      const disponibilidad = await permisoService.getAvailablePermisos(userId);
      res.json({ permisos, disponibilidad });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener permisos del usuario' });
    }
  },

  async aprobar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permiso = await permisoService.updateEstado(id, 'aprobado');
      if (!permiso) {
        res.status(404).json({ message: 'Permiso no encontrado' });
        return;
      }

      const { userRepository } = require('../repositories/user.repository');
      const user = await userRepository.findById(permiso.user_id);
      if (user?.email) {
        await emailService.sendPermisoNotification(user.email, 'aprobado', permiso);
      }

      res.json(permiso);
    } catch (error) {
      res.status(500).json({ message: 'Error al aprobar permiso' });
    }
  },

  async rechazar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { motivo_rechazo } = req.body;

      if (!motivo_rechazo) {
        res.status(400).json({ message: 'Motivo de rechazo requerido' });
        return;
      }

      const permiso = await permisoService.updateEstado(id, 'rechazado', motivo_rechazo);
      if (!permiso) {
        res.status(404).json({ message: 'Permiso no encontrado' });
        return;
      }

      const { userRepository } = require('../repositories/user.repository');
      const user = await userRepository.findById(permiso.user_id);
      if (user?.email) {
        await emailService.sendPermisoNotification(user.email, 'rechazado', { ...permiso, motivo_rechazo });
      }

      res.json(permiso);
    } catch (error) {
      res.status(500).json({ message: 'Error al rechazar permiso' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permiso = await permisoService.findById(id);

      if (!permiso) {
        res.status(404).json({ message: 'Permiso no encontrado' });
        return;
      }

      if (req.user!.rolId !== 1) {
        if (permiso.estado === 'aprobado') {
          res.status(400).json({ message: 'No se puede editar un permiso aprobado' });
          return;
        }
        if (new Date(permiso.fecha_inicio) < new Date()) {
          res.status(400).json({ message: 'No se puede editar un permiso con fecha anterior a hoy' });
          return;
        }
      }

      const updated = await permisoService.update(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Error al editar permiso' });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permiso = await permisoService.findById(id);

      if (!permiso) {
        res.status(404).json({ message: 'Permiso no encontrado' });
        return;
      }

      if (req.user!.rolId !== 1) {
        if (permiso.estado === 'aprobado') {
          res.status(400).json({ message: 'No se puede eliminar un permiso aprobado' });
          return;
        }
        if (new Date(permiso.fecha_inicio) < new Date()) {
          res.status(400).json({ message: 'No se puede eliminar un permiso con fecha anterior a hoy' });
          return;
        }
      }

      const deleted = await permisoService.delete(id);
      res.json({ message: 'Permiso eliminado' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar permiso' });
    }
  },

  async reportePDF(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
      const permisos = await permisoService.getYearlyPermisos(userId, year);

      const { userRepository } = require('../repositories/user.repository');
      const user = await userRepository.findById(userId);

      const { reporteService } = require('../services/reporte.service');
      const pdfBuffer = await reporteService.generarPDF(permisos, {
        nombres: user.nombres, apellido_paterno: user.apellido_paterno, rut: `${user.rut}-${user.dv}`,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=permisos_${year}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ message: 'Error al generar PDF' });
    }
  },

  async reporteExcel(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
      const permisos = await permisoService.getYearlyPermisos(userId, year);

      const { userRepository } = require('../repositories/user.repository');
      const user = await userRepository.findById(userId);

      const { reporteService } = require('../services/reporte.service');
      const excelBuffer = await reporteService.generarExcel(permisos, {
        nombres: user.nombres, apellido_paterno: user.apellido_paterno, rut: `${user.rut}-${user.dv}`,
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=permisos_${year}.xlsx`);
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ message: 'Error al generar Excel' });
    }
  },
};
