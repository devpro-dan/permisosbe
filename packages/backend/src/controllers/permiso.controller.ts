import { Request, Response } from 'express';
import { permisoService } from '../services/permiso.service';
import { emailService } from '../services/email.service';
import { auditLogService } from '../services/auditLog.service';

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + 'T12:00:00').getDay();
  return day === 0 || day === 6;
}

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

      if (isWeekend(fecha_inicio)) {
        res.status(400).json({ message: 'La fecha de inicio no puede ser fin de semana' });
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
        const restantes = await permisoService.getAvailablePermisos(userId);
        await emailService.sendPermisoNotification(user.email, 'solicitado', permiso, user.nombres, { available: restantes.available, max: restantes.max });
      }

      await auditLogService.register(req, 'create', 'permiso', permiso.id, `Solicitó permiso: ${motivo} (${fecha_inicio}${fecha_fin ? ` - ${fecha_fin}` : ''})`);

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
        const restantes = await permisoService.getAvailablePermisos(permiso.user_id);
        await emailService.sendPermisoNotification(user.email, 'aprobado', permiso, user.nombres, { available: restantes.available, max: restantes.max });
      }

      await auditLogService.register(req, 'approve', 'permiso', id, `Aprobó permiso #${id}`);

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
        const restantes = await permisoService.getAvailablePermisos(permiso.user_id);
        await emailService.sendPermisoNotification(user.email, 'rechazado', { ...permiso, motivo_rechazo }, user.nombres, { available: restantes.available, max: restantes.max });
      }

      await auditLogService.register(req, 'reject', 'permiso', id, `Rechazó permiso #${id}: ${motivo_rechazo}`);

      res.json(permiso);
    } catch (error) {
      res.status(500).json({ message: 'Error al rechazar permiso' });
    }
  },

  async solicitarParaUsuario(req: Request, res: Response) {
    try {
      const { user_id, fecha_inicio, fecha_fin, tipo_jornada, motivo } = req.body;

      if (!user_id || !fecha_inicio || !tipo_jornada || !motivo) {
        res.status(400).json({ message: 'Usuario, fecha inicio, tipo jornada y motivo son requeridos' });
        return;
      }

      if (!['completa', 'media'].includes(tipo_jornada)) {
        res.status(400).json({ message: 'Tipo jornada debe ser completa o media' });
        return;
      }

      if (isWeekend(fecha_inicio)) {
        res.status(400).json({ message: 'La fecha de inicio no puede ser fin de semana' });
        return;
      }

      const { userRepository } = require('../repositories/user.repository');
      const targetUser = await userRepository.findById(user_id);
      if (!targetUser) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }

      const disponibilidad = await permisoService.getAvailablePermisos(user_id);
      if (disponibilidad.available <= 0) {
        res.status(400).json({ message: 'El usuario no tiene permisos disponibles para este año' });
        return;
      }

      const overlap = await permisoService.checkOverlap(user_id, fecha_inicio, fecha_fin);
      if (overlap) {
        res.status(400).json({ message: 'El usuario ya tiene un permiso registrado para esa fecha' });
        return;
      }

      const permiso = await permisoService.create({
        user_id, fecha_inicio, fecha_fin, tipo_jornada, motivo,
      });

      if (targetUser.email) {
        const restantes = await permisoService.getAvailablePermisos(user_id);
        await emailService.sendPermisoNotification(targetUser.email, 'solicitado', permiso, targetUser.nombres, { available: restantes.available, max: restantes.max });
      }

      await auditLogService.register(req, 'create_for_user', 'permiso', permiso.id, `Registró permiso para usuario #${user_id}: ${motivo}`);

      res.status(201).json(permiso);
    } catch (error) {
      res.status(500).json({ message: 'Error al registrar permiso para usuario' });
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
      await auditLogService.register(req, 'update', 'permiso', id, `Editó permiso #${id}`);
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

      await permisoService.delete(id);
      await auditLogService.register(req, 'delete', 'permiso', id, `Eliminó permiso #${id}`);
      res.json({ message: 'Permiso eliminado' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar permiso' });
    }
  },

  async certificado(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permiso = await permisoService.findById(id);

      if (!permiso) {
        res.status(404).json({ message: 'Permiso no encontrado' });
        return;
      }

      if (permiso.estado !== 'aprobado') {
        res.status(400).json({ message: 'El permiso debe estar aprobado para generar el certificado' });
        return;
      }

      const { reporteService } = require('../services/reporte.service');
      const pdfBuffer = await reporteService.generarCertificadoAprobacion(permiso, permiso);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=certificado_permiso_${id}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ message: 'Error al generar certificado' });
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

  async reporteGeneralPDF(req: Request, res: Response) {
    try {
      const filters = {
        employee: (req.query.employee as string) || undefined,
        startDate: (req.query.startDate as string) || undefined,
        endDate: (req.query.endDate as string) || undefined,
        year: req.query.year ? parseInt(req.query.year as string, 10) : undefined,
      };
      const permisos = await permisoService.findForReport(filters);
      const { reporteService } = require('../services/reporte.service');
      const pdfBuffer = await reporteService.generarReporteGeneralPDF(permisos, filters);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_general_permisos.pdf');
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ message: 'Error al generar reporte general PDF' });
    }
  },

  async reporteGeneralExcel(req: Request, res: Response) {
    try {
      const filters = {
        employee: (req.query.employee as string) || undefined,
        startDate: (req.query.startDate as string) || undefined,
        endDate: (req.query.endDate as string) || undefined,
        year: req.query.year ? parseInt(req.query.year as string, 10) : undefined,
      };
      const permisos = await permisoService.findForReport(filters);
      const { reporteService } = require('../services/reporte.service');
      const excelBuffer = await reporteService.generarReporteGeneralExcel(permisos, filters);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_general_permisos.xlsx');
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ message: 'Error al generar reporte general Excel' });
    }
  },

  async reporteConsulta(req: Request, res: Response) {
    try {
      const filters = {
        employee: (req.query.employee as string) || undefined,
        startDate: (req.query.startDate as string) || undefined,
        endDate: (req.query.endDate as string) || undefined,
        year: req.query.year ? parseInt(req.query.year as string, 10) : undefined,
      };
      const permisos = await permisoService.findForReport(filters);
      res.json(permisos);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener datos del reporte' });
    }
  },
};
