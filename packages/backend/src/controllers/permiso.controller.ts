import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { permisoService } from '../services/permiso.service';
import { matrimonioService } from '../services/matrimonio.service';
import { emailService } from '../services/email.service';
import { auditLogService } from '../services/auditLog.service';

const UPLOADS_DIR = path.resolve(
  (() => {
    if (process.env.UPLOADS_PATH) return process.env.UPLOADS_PATH;
    const cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, 'packages'))) return path.join(cwd, 'uploads', 'comprobantes');
    return path.join(cwd, 'uploads', 'comprobantes');
  })()
);
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

export const uploadComprobanteMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF, PNG, JPG, JPEG o GIF'));
    }
  },
}).single('comprobante');

export const uploadImportMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
  },
}).single('file');

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + 'T12:00:00').getDay();
  return day === 0 || day === 6;
}

function fmtFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

async function feriadosEnRango(inicio: string, fin?: string): Promise<{ fecha: string; descripcion: string }[]> {
  const { feriadoRepository } = require('../repositories/feriado.repository');
  return feriadoRepository.findEntre(inicio, fin || inicio);
}

function mensajeFeriado(feriado: { fecha: string; descripcion: string }): string {
  return `La fecha ${fmtFecha(feriado.fecha)} corresponde a un feriado (${feriado.descripcion})`;
}

function calcDiasSolicitud(inicio: string, fin: string | undefined, tipo: string): number {
  if (tipo === 'media') return 0.5;
  if (!fin || fin === inicio) return 1;
  const d1 = new Date(inicio + 'T12:00:00');
  const d2 = new Date(fin + 'T12:00:00');
  let count = 0;
  const cur = new Date(d1);
  while (cur <= d2) { const day = cur.getDay(); if (day !== 0 && day !== 6) count++; cur.setDate(cur.getDate() + 1); }
  return Math.max(1, count);
}

function parseCantidadDias(raw: any): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const s = String(raw).trim().toLowerCase().replace(',', '.');
  if (s === 'medio' || s === 'media' || s === '0.5' || s === '.5') return 0.5;
  const n = Number(s);
  if (n === 0.5) return 0.5;
  if (Number.isInteger(n) && n >= 1 && n <= 6) return n;
  return null;
}

function getReportFilters(body: any) {
  const b = body || {};
  const tipoRaw = String(b.tipoPermiso || b.tipo || '').trim().toLowerCase();
  const tipoPermiso = ['administrativo', 'matrimonio', 'todos'].includes(tipoRaw) ? tipoRaw : 'todos';
  return {
    employee: (b.employee as string) || undefined,
    startDate: (b.startDate as string) || undefined,
    endDate: (b.endDate as string) || undefined,
    year: b.year ? parseInt(String(b.year), 10) : undefined,
    cargo: (b.cargo as string) || undefined,
    tipoPermiso: tipoPermiso as 'todos' | 'administrativo' | 'matrimonio',
  };
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
      {
        const f = await feriadosEnRango(fecha_inicio, fecha_inicio);
        if (f.length > 0) { res.status(400).json({ message: mensajeFeriado(f[0]) }); return; }
      }
      if (fecha_fin) {
        if (isWeekend(fecha_fin)) { res.status(400).json({ message: 'La fecha de fin no puede ser fin de semana' }); return; }
        const f = await feriadosEnRango(fecha_fin, fecha_fin);
        if (f.length > 0) { res.status(400).json({ message: mensajeFeriado(f[0]) }); return; }
      }

      const disponibilidad = await permisoService.getAvailablePermisos(userId);
      const diasSolicitados = calcDiasSolicitud(fecha_inicio, fecha_fin, tipo_jornada);
      if (diasSolicitados > disponibilidad.available) {
        const reqStr = diasSolicitados === 0.5 ? 'media jornada' : String(diasSolicitados);
        res.status(400).json({ message: `Solicita ${reqStr} día${diasSolicitados === 1 || diasSolicitados === 0.5 ? '' : 's'}, solo quedan ${disponibilidad.available} días disponibles de ${disponibilidad.max}` });
        return;
      }

      const overlap = await permisoService.checkOverlap(userId, fecha_inicio, fecha_fin);
      if (overlap) {
        res.status(400).json({ message: 'Ya tienes un permiso registrado para esa fecha' });
        return;
      }

      let fechaFinAjustada: string | undefined = fecha_fin || undefined;
      if (fechaFinAjustada) {
        const diasHabilesSolicitados = calcDiasSolicitud(fecha_inicio, fechaFinAjustada, tipo_jornada);
        let cur = new Date(fecha_inicio + 'T12:00:00');
        let remaining = tipo_jornada === 'media' ? 0 : diasHabilesSolicitados - 1;
        let safety = 0;
        while (remaining > 0 && safety < 60) {
          cur.setDate(cur.getDate() + 1);
          const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          if (isWeekend(iso)) { safety++; continue; }
          const fer = await feriadosEnRango(iso, iso);
          if (fer.length > 0) { safety++; continue; }
          remaining--; safety++;
        }
        fechaFinAjustada = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        if (tipo_jornada === 'media') fechaFinAjustada = fecha_inicio;
      }

      const permiso = await permisoService.create({
        user_id: userId, fecha_inicio, fecha_fin: fechaFinAjustada, tipo_jornada, motivo,
      });

      try {
        const { userRepository } = require('../repositories/user.repository');
        const user = await userRepository.findById(userId);
        if (user?.email) {
          const restantes = await permisoService.getAvailablePermisos(userId);
          await emailService.sendPermisoNotification(user.email, 'solicitado', permiso, user.nombres, { available: restantes.available, max: restantes.max });
        }
      } catch (emailError) {
        console.error('Error enviando notificación al solicitar permiso:', emailError);
      }

      try {
        await auditLogService.register(req, 'create', 'permiso', permiso.id, `Solicitó permiso: ${motivo} (${fecha_inicio}${fecha_fin ? ` - ${fecha_fin}` : ''})`);
      } catch (auditError) {
        console.error('Error registrando auditoría al solicitar permiso:', auditError);
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

      try {
        const { userRepository } = require('../repositories/user.repository');
        const user = await userRepository.findById(permiso.user_id);
        if (user?.email) {
          const restantes = await permisoService.getAvailablePermisos(permiso.user_id);
          await emailService.sendPermisoNotification(user.email, 'aprobado', permiso, user.nombres, { available: restantes.available, max: restantes.max });
        }
      } catch (emailError) {
        console.error('Error enviando notificación al aprobar permiso:', emailError);
      }

      try {
        await auditLogService.register(req, 'approve', 'permiso', id, `Aprobó permiso #${id}`);
      } catch (auditError) {
        console.error('Error registrando auditoría al aprobar permiso:', auditError);
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

      try {
        const { userRepository } = require('../repositories/user.repository');
        const user = await userRepository.findById(permiso.user_id);
        if (user?.email) {
          const restantes = await permisoService.getAvailablePermisos(permiso.user_id);
          await emailService.sendPermisoNotification(user.email, 'rechazado', { ...permiso, motivo_rechazo }, user.nombres, { available: restantes.available, max: restantes.max });
        }
      } catch (emailError) {
        console.error('Error enviando notificación al rechazar permiso:', emailError);
      }

      try {
        await auditLogService.register(req, 'reject', 'permiso', id, `Rechazó permiso #${id}: ${motivo_rechazo}`);
      } catch (auditError) {
        console.error('Error registrando auditoría al rechazar permiso:', auditError);
      }

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
      {
        const f = await feriadosEnRango(fecha_inicio, fecha_inicio);
        if (f.length > 0) { res.status(400).json({ message: mensajeFeriado(f[0]) }); return; }
      }
      if (fecha_fin) {
        if (isWeekend(fecha_fin)) { res.status(400).json({ message: 'La fecha de fin no puede ser fin de semana' }); return; }
        const f = await feriadosEnRango(fecha_fin, fecha_fin);
        if (f.length > 0) { res.status(400).json({ message: mensajeFeriado(f[0]) }); return; }
      }

      const { userRepository } = require('../repositories/user.repository');
      const targetUser = await userRepository.findById(user_id);
      if (!targetUser) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }

      const disponibilidad = await permisoService.getAvailablePermisos(user_id);
      const diasSolicitados = calcDiasSolicitud(fecha_inicio, fecha_fin, tipo_jornada);
      if (diasSolicitados > disponibilidad.available) {
        const reqStr = diasSolicitados === 0.5 ? 'media jornada' : String(diasSolicitados);
        res.status(400).json({ message: `Solicita ${reqStr} día${diasSolicitados === 1 || diasSolicitados === 0.5 ? '' : 's'}, solo quedan ${disponibilidad.available} días disponibles de ${disponibilidad.max}` });
        return;
      }

      const overlap = await permisoService.checkOverlap(user_id, fecha_inicio, fecha_fin);
      if (overlap) {
        res.status(400).json({ message: 'El usuario ya tiene un permiso registrado para esa fecha' });
        return;
      }

      let fechaFinAjustada2: string | undefined = fecha_fin || undefined;
      if (fechaFinAjustada2) {
        const diasHabilesSolicitados = calcDiasSolicitud(fecha_inicio, fechaFinAjustada2, tipo_jornada);
        let cur = new Date(fecha_inicio + 'T12:00:00');
        let remaining = tipo_jornada === 'media' ? 0 : diasHabilesSolicitados - 1;
        let safety = 0;
        while (remaining > 0 && safety < 60) {
          cur.setDate(cur.getDate() + 1);
          const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          if (isWeekend(iso)) { safety++; continue; }
          const fer = await feriadosEnRango(iso, iso);
          if (fer.length > 0) { safety++; continue; }
          remaining--; safety++;
        }
        fechaFinAjustada2 = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        if (tipo_jornada === 'media') fechaFinAjustada2 = fecha_inicio;
      }

      const permiso = await permisoService.create({
        user_id, fecha_inicio, fecha_fin: fechaFinAjustada2, tipo_jornada, motivo,
      });

      try {
        if (targetUser.email) {
          const restantes = await permisoService.getAvailablePermisos(user_id);
          await emailService.sendPermisoNotification(targetUser.email, 'solicitado', permiso, targetUser.nombres, { available: restantes.available, max: restantes.max });
        }
      } catch (emailError) {
        console.error('Error enviando notificación al registrar permiso para usuario:', emailError);
      }

      try {
        await auditLogService.register(req, 'create_for_user', 'permiso', permiso.id, `Registró permiso para usuario #${user_id}: ${motivo}`);
      } catch (auditError) {
        console.error('Error registrando auditoría al crear permiso para usuario:', auditError);
      }

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

      if (permiso.estado !== 'en_revision') {
        res.status(400).json({ message: 'Solo se pueden editar permisos en estado En Revisión' });
        return;
      }

      const { fecha_inicio, fecha_fin, tipo_jornada, motivo } = req.body;

      if (fecha_inicio !== undefined && isWeekend(fecha_inicio)) {
        res.status(400).json({ message: 'La fecha de inicio no puede ser fin de semana' });
        return;
      }

      if (tipo_jornada !== undefined && !['completa', 'media'].includes(tipo_jornada)) {
        res.status(400).json({ message: 'Tipo jornada debe ser completa o media' });
        return;
      }

      const nuevaFechaInicio = fecha_inicio !== undefined ? fecha_inicio : permiso.fecha_inicio;
      const nuevaFechaFin = fecha_fin !== undefined ? fecha_fin : permiso.fecha_fin;

      {
        const f = await feriadosEnRango(nuevaFechaInicio, nuevaFechaInicio);
        if (f.length > 0) { res.status(400).json({ message: mensajeFeriado(f[0]) }); return; }
      }
      if (nuevaFechaFin) {
        if (isWeekend(nuevaFechaFin)) { res.status(400).json({ message: 'La fecha de fin no puede ser fin de semana' }); return; }
        const f = await feriadosEnRango(nuevaFechaFin, nuevaFechaFin);
        if (f.length > 0) { res.status(400).json({ message: mensajeFeriado(f[0]) }); return; }
      }

      const overlap = await permisoService.checkOverlap(permiso.user_id, nuevaFechaInicio, nuevaFechaFin, id);
      if (overlap) {
        res.status(400).json({ message: 'El trabajador ya tiene un permiso registrado que se cruza con estas fechas' });
        return;
      }

      const updated = await permisoService.update(id, { fecha_inicio, fecha_fin, tipo_jornada, motivo });
      try {
        await auditLogService.register(req, 'update', 'permiso', id, `Editó permiso #${id}`);
      } catch (auditError) {
        console.error('Error registrando auditoría al editar permiso:', auditError);
      }
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
      try {
        await auditLogService.register(req, 'delete', 'permiso', id, `Eliminó permiso #${id}`);
      } catch (auditError) {
        console.error('Error registrando auditoría al eliminar permiso:', auditError);
      }
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

  async subirComprobante(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permiso = await permisoService.findById(id);

      if (!permiso) {
        res.status(404).json({ message: 'Permiso no encontrado' });
        return;
      }

      if (permiso.estado !== 'aprobado') {
        res.status(400).json({ message: 'El permiso debe estar aprobado para subir un comprobante' });
        return;
      }

      uploadComprobanteMiddleware(req, res, async (err) => {
        if (err) {
          res.status(400).json({ message: err.message || 'Error al subir archivo' });
          return;
        }

        if (!req.file) {
          res.status(400).json({ message: 'Debe seleccionar un archivo' });
          return;
        }

        const comprobanteUrl = `comprobantes/${req.file.filename}`;
        if (permiso.comprobante_url) {
          const previousPath = path.resolve(UPLOADS_DIR, '..', permiso.comprobante_url);
          if (fs.existsSync(previousPath)) {
            fs.unlinkSync(previousPath);
          }
        }
        const updated = await permisoService.saveComprobante(id, comprobanteUrl);

        await auditLogService.register(req, 'update', 'permiso', id, `Subió comprobante de aprobación para permiso #${id}`);

        res.json(updated);
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al subir comprobante' });
    }
  },

  async descargarComprobante(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permiso = await permisoService.findById(id);

      if (!permiso) {
        res.status(404).json({ message: 'Permiso no encontrado' });
        return;
      }

      if (!permiso.comprobante_url) {
        res.status(404).json({ message: 'No hay comprobante para este permiso' });
        return;
      }

      const filePath = path.resolve(UPLOADS_DIR, '..', permiso.comprobante_url);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ message: 'Archivo no encontrado en el servidor' });
        return;
      }

      res.sendFile(filePath);
    } catch (error) {
      res.status(500).json({ message: 'Error al descargar comprobante' });
    }
  },

  async reporteAnos(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const anos = await permisoService.getAnosDisponibles(userId);
      res.json({ anos });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener años disponibles' });
    }
  },

  async dashboardIndicadores(req: Request, res: Response) {
    try {
      const data = await permisoService.getDashboardIndicadores();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener indicadores' });
    }
  },

  async reportePDF(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const year = parseInt((req.body.year as string) || String(new Date().getFullYear()));
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
      const year = parseInt((req.body.year as string) || String(new Date().getFullYear()));
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
      const filters = getReportFilters(req.body);
      const tipo = (filters as any).tipoPermiso;
      let permisos: any[];
      if (tipo === 'matrimonio') permisos = await matrimonioService.findForReport(filters);
      else if (tipo === 'administrativo') { const r = await permisoService.findForReport(filters); permisos = r.map((x: any) => ({ ...x, _tipo: 'administrativo' })); }
      else { const [a, m] = await Promise.all([permisoService.findForReport(filters).then((r: any[]) => r.map((x) => ({ ...x, _tipo: 'administrativo' }))), matrimonioService.findForReport(filters)]); permisos = [...a, ...m].sort((x, y) => new Date(y.fecha_inicio).getTime() - new Date(x.fecha_inicio).getTime()); }
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
      const filters = getReportFilters(req.body);
      const tipo = (filters as any).tipoPermiso;
      let permisos: any[];
      if (tipo === 'matrimonio') permisos = await matrimonioService.findForReport(filters);
      else if (tipo === 'administrativo') { const r = await permisoService.findForReport(filters); permisos = r.map((x: any) => ({ ...x, _tipo: 'administrativo' })); }
      else { const [a, m] = await Promise.all([permisoService.findForReport(filters).then((r: any[]) => r.map((x) => ({ ...x, _tipo: 'administrativo' }))), matrimonioService.findForReport(filters)]); permisos = [...a, ...m].sort((x, y) => new Date(y.fecha_inicio).getTime() - new Date(x.fecha_inicio).getTime()); }
      const { reporteService } = require('../services/reporte.service');
      const excelBuffer = await reporteService.generarReporteGeneralExcel(permisos, filters);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_general_permisos.xlsx');
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ message: 'Error al generar reporte general Excel' });
    }
  },

  async reporteResumenTrabajadores(req: Request, res: Response) {
    try {
      const filters = getReportFilters(req.body);
      const resumen = await permisoService.getResumenTrabajadores(filters);
      res.json(resumen);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener resumen por trabajador' });
    }
  },

  async reporteResumenTrabajadoresPDF(req: Request, res: Response) {
    try {
      const filters = getReportFilters(req.body);
      const resumen = await permisoService.getResumenTrabajadores(filters);
      const { reporteService } = require('../services/reporte.service');
      const pdfBuffer = await reporteService.generarReporteTrabajadoresPDF(resumen.trabajadores, resumen.maxDias, filters);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_dias_por_trabajador.pdf');
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ message: 'Error al generar reporte de días por trabajador' });
    }
  },

  async reporteResumenTrabajadoresExcel(req: Request, res: Response) {
    try {
      const filters = getReportFilters(req.body);
      const resumen = await permisoService.getResumenTrabajadores(filters);
      const { reporteService } = require('../services/reporte.service');
      const excelBuffer = await reporteService.generarReporteTrabajadoresExcel(resumen.trabajadores, resumen.maxDias, filters);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_dias_por_trabajador.xlsx');
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ message: 'Error al generar reporte de días por trabajador' });
    }
  },

  async reporteConsulta(req: Request, res: Response) {
    try {
      const filters = getReportFilters(req.body);
      const tipo = (filters as any).tipoPermiso;
      let permisos: any[];
      if (tipo === 'matrimonio') permisos = await matrimonioService.findForReport(filters);
      else if (tipo === 'administrativo') { const r = await permisoService.findForReport(filters); permisos = r.map((x: any) => ({ ...x, _tipo: 'administrativo' })); }
      else { const [a, m] = await Promise.all([permisoService.findForReport(filters).then((r: any[]) => r.map((x) => ({ ...x, _tipo: 'administrativo' }))), matrimonioService.findForReport(filters)]); permisos = [...a, ...m].sort((x, y) => new Date(y.fecha_inicio).getTime() - new Date(x.fecha_inicio).getTime()); }
      res.json(permisos);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener datos del reporte' });
    }
  },

  async generarOficio(req: Request, res: Response) {
    try {
      const month = (req.body.month as string) || '';
      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ message: 'Debe indicar el mes en formato AAAA-MM' });
        return;
      }
      const ord = ((req.body.ord as string) || '').trim();
      if (ord && !/^\d{1,4}$/.test(ord)) {
        res.status(400).json({ message: 'El número de Ord. debe contener solo números y máximo 4 dígitos' });
        return;
      }
      const permisos = await permisoService.getPermisosDelMes(month);
      const { oficioService } = require('../services/oficio.service');
      const docxBuffer = await oficioService.generarOficio(permisos, month, ord);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=oficio_permisos_${month}.docx`);
      res.send(docxBuffer);
    } catch (error) {
      res.status(500).json({ message: 'Error al generar el oficio' });
    }
  },

  async descargarPlantillaImport(req: Request, res: Response) {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Plantilla');
      const instrucciones = workbook.addWorksheet('Instrucciones');

      instrucciones.columns = [
        { header: 'Campo', key: 'campo', width: 22 },
        { header: 'Requerido', key: 'req', width: 12 },
        { header: 'Formato / Valores', key: 'formato', width: 42 },
        { header: 'Ejemplo', key: 'ejemplo', width: 24 },
        { header: 'Descripción', key: 'desc', width: 50 },
      ];
      instrucciones.addRows([
        { campo: 'rut', req: 'Sí', formato: 'Sólo números y K, sin puntos ni guion', ejemplo: '12345678', desc: 'Identifica al funcionario. Debe existir en la plataforma. Clave foránea permisos_administrativos.user_id → users.id' },
        { campo: 'dv', req: 'Sí', formato: '0-9 o K (1 carácter)', ejemplo: '5', desc: 'Dígito verificador del RUT.' },
        { campo: 'fecha_inicio', req: 'Sí', formato: 'YYYY-MM-DD', ejemplo: '2026-03-02', desc: 'Fecha inicio del permiso. No puede ser fin de semana ni feriado.' },
        { campo: 'cantidad_dias', req: 'Sí', formato: '1 a 6, 0.5 o medio', ejemplo: '2', desc: 'Cantidad de días hábiles. Admite 0.5 o medio (=0.5). La fecha_fin se calcula automáticamente (días hábiles consecutivos, saltando fines de semana y feriados).' },
        { campo: 'tipo_jornada', req: 'Sí', formato: 'completa | media', ejemplo: 'completa', desc: 'Si cantidad_dias > 1 debe ser completa. Si cantidad_dias es 0.5/medio debe ser media. Media solo para 1 día o 0.5.' },
        { campo: 'motivo', req: 'Sí', formato: 'Texto libre (máx 500)', ejemplo: 'Trámite personal', desc: 'Motivo del permiso administrativo.' },
      ]);
      instrucciones.getRow(1).font = { bold: true };
      instrucciones.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } } as any;
      instrucciones.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } } as any;
      instrucciones.addRow([]);
      instrucciones.addRow({ campo: 'Relación: permisos_administrativos.user_id → users.id (se resuelve por RUT+DV).' });
      instrucciones.addRow({ campo: 'Notas:' });
      instrucciones.addRow({ campo: '- La planilla no debe tener filas vacías entre datos.' });
      instrucciones.addRow({ campo: '- Fechas en formato Excel (fecha) también son aceptadas.' });
      instrucciones.addRow({ campo: '- La fecha de término se calcula sola: fecha_inicio + (cantidad_dias-1) días hábiles (sin finde/feriado).' });
      instrucciones.addRow({ campo: '- Se valida disponibilidad anual, fines de semana, feriados y cruces con otros permisos.' });

      sheet.columns = [
        { header: 'rut', key: 'rut', width: 14 },
        { header: 'dv', key: 'dv', width: 6 },
        { header: 'fecha_inicio', key: 'fecha_inicio', width: 16 },
        { header: 'cantidad_dias', key: 'cantidad_dias', width: 14 },
        { header: 'tipo_jornada', key: 'tipo_jornada', width: 16 },
        { header: 'motivo', key: 'motivo', width: 42 },
      ];
      const headerRow = sheet.getRow(1);
      headerRow.values = ['rut', 'dv', 'fecha_inicio', 'cantidad_dias', 'tipo_jornada', 'motivo'];
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } } as any;
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 20;
      sheet.addRows([
        { rut: '12345678', dv: '5', fecha_inicio: '2026-03-02', cantidad_dias: 1, tipo_jornada: 'completa', motivo: 'Trámite personal' },
        { rut: '8765432', dv: 'K', fecha_inicio: '2026-03-09', cantidad_dias: 2, tipo_jornada: 'completa', motivo: 'Control médico' },
        { rut: '11222333', dv: '4', fecha_inicio: '2026-03-12', cantidad_dias: 1, tipo_jornada: 'media', motivo: 'Asunto familiar' },
      ]);
      sheet.getColumn('rut').numFmt = '@';
      sheet.getColumn('dv').numFmt = '@';
      for (let i = 2; i <= 200; i++) {
        (sheet.getCell(`E${i}`) as any).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"completa,media"'],
          showErrorMessage: true,
          errorTitle: 'Valor inválido',
          error: 'Tipo jornada debe ser completa o media',
        };
      }
      sheet.autoFilter = { from: 'A1', to: 'F1' } as any;

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_permisos_administrativos.xlsx');
      res.send(Buffer.from(buffer));
    } catch (error) {
      res.status(500).json({ message: 'Error al generar plantilla' });
    }
  },

  async previsualizarPlanilla(req: Request, res: Response) {
    uploadImportMiddleware(req, res, async (err: any) => {
      if (err) { res.status(400).json({ message: err.message || 'Error al subir archivo' }); return; }
      if (!req.file) { res.status(400).json({ message: 'Debe seleccionar un archivo Excel (.xlsx)' }); return; }
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer as any);
        const sheet = workbook.worksheets[0];
        if (!sheet) { res.status(400).json({ message: 'La planilla no contiene hojas' }); return; }
        const headerRow = sheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell((cell, colNumber) => { headers[colNumber - 1] = String(cell.value || '').trim().toLowerCase().replace(/\s+/g, '_'); });
        const idx: Record<string, number> = {};
        headers.forEach((h, i) => { idx[h] = i; });
        const required = ['rut', 'dv', 'fecha_inicio', 'cantidad_dias', 'tipo_jornada', 'motivo'];
        for (const r of required) {
          if (idx[r] === undefined) { res.status(400).json({ message: `Columna requerida faltante: ${r}. Columnas esperadas: rut, dv, fecha_inicio, cantidad_dias, tipo_jornada, motivo` }); return; }
        }
        const toISO = (v: any): string => {
          if (v === null || v === undefined || v === '') return '';
          if (v instanceof Date) { const y = v.getFullYear(); const m = String(v.getMonth() + 1).padStart(2, '0'); const d = String(v.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
          const s = String(v).trim();
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) { const [d, m, y] = s.split('/'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
          return s.slice(0, 10);
        };
        const pool = require('../config/database').default;
        const preview: any[] = [];
        const errors: Array<{ fila: number; message: string }> = [];
        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
          const row = sheet.getRow(rowNumber);
          const vals = row.values as any[];
          const isEmpty = row.cellCount === 0 || (Array.isArray(vals) && vals.slice(1).every((v: any) => v === null || v === undefined || String(v).trim() === ''));
          if (isEmpty) continue;
          const get = (col: string) => {
            const cIdx = idx[col];
            if (cIdx === undefined) return '';
            const cell = row.getCell(cIdx + 1);
            const val = cell.value;
            if (val === null || val === undefined) return '';
            if (typeof val === 'object' && (val as any).text !== undefined) return String((val as any).text).trim();
            if (val instanceof Date) return val;
            return String(val).trim();
          };
          const rutRaw = get('rut'); const dvRaw = get('dv'); const fechaInicioRaw = get('fecha_inicio'); const cantidadRaw = get('cantidad_dias');
          const tipoJornadaRaw = String(get('tipo_jornada') || '').trim().toLowerCase(); const motivoRaw = String(get('motivo') || '').trim();
          const fecha_inicio = toISO(fechaInicioRaw); const cantidadDias = parseCantidadDias(cantidadRaw);
          let fecha_fin: string | undefined = undefined;
          let error: string | null = null;
          let rutDisplay = `${String(rutRaw).trim()}-${String(dvRaw).trim()}`;
          if (!motivoRaw) error = 'Motivo requerido';
          else if (!['completa', 'media'].includes(tipoJornadaRaw)) error = 'tipo_jornada debe ser completa o media';
          else if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio)) error = `fecha_inicio inválida (${fechaInicioRaw})`;
          else if (cantidadDias === null) error = `cantidad_dias inválida (${cantidadRaw}) debe ser 1 a 6, 0.5 o medio`;
          else if (cantidadDias === 0.5 && tipoJornadaRaw !== 'media') error = 'cantidad_dias 0.5/medio solo permite tipo_jornada media';
          else if (tipoJornadaRaw === 'media' && cantidadDias !== 1 && cantidadDias !== 0.5) error = 'Media jornada solo permite cantidad_dias = 1 o 0.5/medio';
          else if (isWeekend(fecha_inicio)) error = 'fecha_inicio no puede ser fin de semana';
          else {
            const feriadosInicio = await feriadosEnRango(fecha_inicio, fecha_inicio);
            if (feriadosInicio.length > 0) error = mensajeFeriado(feriadosInicio[0]);
          }
          if (!error) {
            const addBusinessDaysCalc = async (inicio: string, dias: number): Promise<string> => {
              if (dias <= 1) return inicio;
              let cur = new Date(inicio + 'T12:00:00'); let remaining = dias - 1; let safety = 0;
              while (remaining > 0 && safety < 60) {
                cur.setDate(cur.getDate() + 1);
                const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
                if (isWeekend(iso)) { safety++; continue; }
                const f = await feriadosEnRango(iso, iso);
                if (f.length > 0) { safety++; continue; }
                remaining--; safety++;
              }
              return `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
            };
            fecha_fin = cantidadDias! > 1 ? await addBusinessDaysCalc(fecha_inicio, cantidadDias!) : undefined;
            if (fecha_fin) {
              const feriadosFin = await feriadosEnRango(fecha_fin, fecha_fin);
              if (feriadosFin.length > 0) error = mensajeFeriado(feriadosFin[0]);
              else if (isWeekend(fecha_fin)) error = 'Fecha de término calculada cae en fin de semana';
            }
          }
          if (!error) {
            const rutNorm = String(rutRaw).trim().toUpperCase().replace(/[^0-9K]/g, ''); const dvNorm = String(dvRaw).trim().toUpperCase();
            if (!rutNorm || !dvNorm || !/^[0-9K]+$/.test(rutNorm) || !/^[0-9K]$/.test(dvNorm)) error = `RUT inválido (${rutRaw}-${dvRaw})`;
            else {
              const r = await pool.query('SELECT id, nombres, apellido_paterno FROM users WHERE rut = $1 AND dv = $2', [rutNorm, dvNorm]);
              if (!r.rows[0]) error = `Usuario no encontrado por RUT ${rutNorm}-${dvNorm}`;
              else {
                const userId = r.rows[0].id;
                const disponibilidad = await permisoService.getAvailablePermisos(userId);
                const diasNecesarios = tipoJornadaRaw === 'media' || cantidadDias === 0.5 ? 0.5 : cantidadDias!;
                if (diasNecesarios > disponibilidad.available) {
                  const reqStr = diasNecesarios === 0.5 ? 'media jornada' : String(diasNecesarios);
                  error = `Solicita ${reqStr} día${diasNecesarios === 1 || diasNecesarios === 0.5 ? '' : 's'}, solo quedan ${disponibilidad.available} disponibles de ${disponibilidad.max}`;
                } else {
                  const overlap = await permisoService.checkOverlap(userId, fecha_inicio, fecha_fin);
                  if (overlap) error = 'Ya tiene un permiso registrado para esa fecha';
                }
              }
            }
          }
          if (error) errors.push({ fila: rowNumber, message: error });
          preview.push({ fila: rowNumber, rut: rutDisplay, fecha_inicio, cantidad_dias: String(cantidadRaw).trim(), tipo_jornada: tipoJornadaRaw, motivo: motivoRaw, fecha_fin: fecha_fin || fecha_inicio, error, valido: !error });
        }
        res.json({ preview, errors, total: preview.length });
      } catch (error: any) { res.status(500).json({ message: error.message || 'Error al previsualizar planilla' }); }
    });
  },

  async importarPlanilla(req: Request, res: Response) {
    uploadImportMiddleware(req, res, async (err: any) => {
      if (err) { res.status(400).json({ message: err.message || 'Error al subir archivo' }); return; }
      if (!req.file) { res.status(400).json({ message: 'Debe seleccionar un archivo Excel (.xlsx)' }); return; }
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer as any);
        const sheet = workbook.worksheets[0];
        if (!sheet) { res.status(400).json({ message: 'La planilla no contiene hojas' }); return; }
        const headerRow = sheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell((cell, colNumber) => { headers[colNumber - 1] = String(cell.value || '').trim().toLowerCase().replace(/\s+/g, '_'); });
        const idx: Record<string, number> = {};
        headers.forEach((h, i) => { idx[h] = i; });
        const required = ['rut', 'dv', 'fecha_inicio', 'cantidad_dias', 'tipo_jornada', 'motivo'];
        for (const r of required) {
          if (idx[r] === undefined) { res.status(400).json({ message: `Columna requerida faltante: ${r}. Columnas esperadas: rut, dv, fecha_inicio, cantidad_dias, tipo_jornada, motivo` }); return; }
        }
        const toISO = (v: any): string => {
          if (v === null || v === undefined || v === '') return '';
          if (v instanceof Date) { const y = v.getFullYear(); const m = String(v.getMonth() + 1).padStart(2, '0'); const d = String(v.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
          const s = String(v).trim();
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) { const [d, m, y] = s.split('/'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
          return s.slice(0, 10);
        };
        const pool = require('../config/database').default;
        const errors: Array<{ fila: number; message: string }> = [];
        let created = 0;
        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
          const row = sheet.getRow(rowNumber);
          const vals = row.values as any[];
          const isEmpty = row.cellCount === 0 || (Array.isArray(vals) && vals.slice(1).every((v: any) => v === null || v === undefined || String(v).trim() === ''));
          if (isEmpty) continue;
          const get = (col: string) => {
            const cIdx = idx[col];
            if (cIdx === undefined) return '';
            const cell = row.getCell(cIdx + 1);
            const val = cell.value;
            if (val === null || val === undefined) return '';
            if (typeof val === 'object' && (val as any).text !== undefined) return String((val as any).text).trim();
            if (val instanceof Date) return val;
            return String(val).trim();
          };
          const rutRaw = get('rut'); const dvRaw = get('dv'); const fechaInicioRaw = get('fecha_inicio'); const cantidadRaw = get('cantidad_dias');
          const tipoJornadaRaw = String(get('tipo_jornada') || '').trim().toLowerCase(); const motivoRaw = String(get('motivo') || '').trim();
          const fecha_inicio = toISO(fechaInicioRaw); const cantidadDias = parseCantidadDias(cantidadRaw);
          if (!motivoRaw) { errors.push({ fila: rowNumber, message: 'Motivo requerido' }); continue; }
          if (!['completa', 'media'].includes(tipoJornadaRaw)) { errors.push({ fila: rowNumber, message: 'tipo_jornada debe ser completa o media' }); continue; }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio)) { errors.push({ fila: rowNumber, message: `fecha_inicio inválida (${fechaInicioRaw}) use YYYY-MM-DD` }); continue; }
          if (cantidadDias === null) { errors.push({ fila: rowNumber, message: `cantidad_dias inválida (${cantidadRaw}) debe ser 1 a 6, 0.5 o medio` }); continue; }
          if (cantidadDias === 0.5 && tipoJornadaRaw !== 'media') { errors.push({ fila: rowNumber, message: 'cantidad_dias 0.5/medio solo permite tipo_jornada media' }); continue; }
          if (tipoJornadaRaw === 'media' && cantidadDias !== 1 && cantidadDias !== 0.5) { errors.push({ fila: rowNumber, message: 'Media jornada solo permite cantidad_dias = 1 o 0.5/medio' }); continue; }
          if (isWeekend(fecha_inicio)) { errors.push({ fila: rowNumber, message: 'fecha_inicio no puede ser fin de semana' }); continue; }
          const feriadosInicio = await feriadosEnRango(fecha_inicio, fecha_inicio);
          if (feriadosInicio.length > 0) { errors.push({ fila: rowNumber, message: mensajeFeriado(feriadosInicio[0]) }); continue; }
          const addBusinessDaysCalc = async (inicio: string, dias: number): Promise<string> => {
            if (dias <= 1) return inicio;
            let cur = new Date(inicio + 'T12:00:00'); let remaining = dias - 1; let safety = 0;
            while (remaining > 0 && safety < 60) {
              cur.setDate(cur.getDate() + 1);
              const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
              if (isWeekend(iso)) { safety++; continue; }
              const f = await feriadosEnRango(iso, iso);
              if (f.length > 0) { safety++; continue; }
              remaining--; safety++;
            }
            return `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          };
          const fecha_fin = cantidadDias! > 1 ? await addBusinessDaysCalc(fecha_inicio, cantidadDias!) : undefined;
          if (fecha_fin) {
            const feriadosFin = await feriadosEnRango(fecha_fin, fecha_fin);
            if (feriadosFin.length > 0) { errors.push({ fila: rowNumber, message: mensajeFeriado(feriadosFin[0]) }); continue; }
            if (isWeekend(fecha_fin)) { errors.push({ fila: rowNumber, message: 'La fecha de término calculada cae en fin de semana' }); continue; }
          }
          let userId: number | null = null;
          const rutNorm = String(rutRaw).trim().toUpperCase().replace(/[^0-9K]/g, ''); const dvNorm = String(dvRaw).trim().toUpperCase();
          if (!rutNorm || !dvNorm || !/^[0-9K]+$/.test(rutNorm) || !/^[0-9K]$/.test(dvNorm)) { errors.push({ fila: rowNumber, message: `RUT inválido (${rutRaw}-${dvRaw})` }); continue; }
          {
            const r = await pool.query('SELECT id FROM users WHERE rut = $1 AND dv = $2', [rutNorm, dvNorm]);
            if (r.rows[0]) userId = r.rows[0].id;
            else { errors.push({ fila: rowNumber, message: `Usuario no encontrado por RUT ${rutNorm}-${dvNorm}` }); continue; }
          }
          const disponibilidad = await permisoService.getAvailablePermisos(userId!);
          const diasNecesarios2 = tipoJornadaRaw === 'media' || cantidadDias === 0.5 ? 0.5 : cantidadDias!;
          if (diasNecesarios2 > disponibilidad.available) {
            const reqStr = diasNecesarios2 === 0.5 ? 'media jornada' : String(diasNecesarios2);
            errors.push({ fila: rowNumber, message: `Solicita ${reqStr} día${diasNecesarios2 === 1 || diasNecesarios2 === 0.5 ? '' : 's'}, solo quedan ${disponibilidad.available} disponibles de ${disponibilidad.max}` }); continue;
          }
          const overlap = await permisoService.checkOverlap(userId!, fecha_inicio, fecha_fin);
          if (overlap) { errors.push({ fila: rowNumber, message: 'Ya tiene un permiso registrado para esa fecha' }); continue; }
          try { await permisoService.create({ user_id: userId!, fecha_inicio, fecha_fin: fecha_fin || undefined, tipo_jornada: tipoJornadaRaw as any, motivo: motivoRaw }); created++; } catch (e: any) { errors.push({ fila: rowNumber, message: e.message || 'Error al crear permiso' }); }
        }
        try { await auditLogService.register(req, 'import', 'permiso', 0, `Importó planilla permisos: ${created} creados, ${errors.length} errores`); } catch {}
        res.json({ created, errors, total: created + errors.length });
      } catch (error: any) { res.status(500).json({ message: error.message || 'Error al procesar planilla' }); }
    });
  },
};
