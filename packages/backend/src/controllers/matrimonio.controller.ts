import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { matrimonioService, DIAS_MATRIMONIO } from '../services/matrimonio.service';
import { auditLogService } from '../services/auditLog.service';

const UPLOADS_DIR = path.resolve(
  (() => {
    if (process.env.UPLOADS_PATH) return process.env.UPLOADS_PATH;
    const cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, 'packages'))) return path.join(cwd, 'uploads', 'comprobantes');
    return path.join(cwd, 'uploads', 'comprobantes');
  })()
);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

export const uploadMatrimonioComprobanteMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF, PNG, JPG, JPEG o GIF'));
  },
}).single('comprobante');

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + 'T12:00:00').getDay();
  return day === 0 || day === 6;
}

async function feriadosEnRango(inicio: string, fin?: string): Promise<{ fecha: string; descripcion: string }[]> {
  const { feriadoRepository } = require('../repositories/feriado.repository');
  return feriadoRepository.findEntre(inicio, fin || inicio);
}

function mensajeFeriado(feriado: { fecha: string; descripcion: string }): string {
  const [y, m, d] = feriado.fecha.split('-');
  return `La fecha ${d}/${m}/${y} corresponde a un feriado (${feriado.descripcion})`;
}

async function calcularFechaFin(fechaInicio: string): Promise<string> {
  const { feriadoRepository } = require('../repositories/feriado.repository');
  const endEstimate = new Date(fechaInicio + 'T12:00:00');
  endEstimate.setDate(endEstimate.getDate() + 14);
  const isoEnd = `${endEstimate.getFullYear()}-${String(endEstimate.getMonth() + 1).padStart(2, '0')}-${String(endEstimate.getDate()).padStart(2, '0')}`;
  const feriadosList = await feriadoRepository.findEntre(fechaInicio, isoEnd);
  const feriadosSet = new Set<string>(feriadosList.map((f: any) => String(f.fecha).slice(0, 10)));
  return matrimonioService.calcularFechaFin(fechaInicio, feriadosSet);
}

export const matrimonioController = {
  async misPermisos(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const permisos = await matrimonioService.findByUser(userId);
      res.json({ permisos });
    } catch { res.status(500).json({ message: 'Error al obtener permisos de matrimonio' }); }
  },

  async solicitar(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { fecha_inicio, motivo } = req.body;
      if (!fecha_inicio || !motivo) { res.status(400).json({ message: 'Fecha inicio y motivo son requeridos' }); return; }
      if (isWeekend(fecha_inicio)) { res.status(400).json({ message: 'La fecha de inicio no puede ser fin de semana' }); return; }
      const fIni = await feriadosEnRango(fecha_inicio, fecha_inicio);
      if (fIni.length > 0) { res.status(400).json({ message: mensajeFeriado(fIni[0]) }); return; }
      const fecha_fin = await calcularFechaFin(fecha_inicio);
      if (isWeekend(fecha_fin)) { res.status(400).json({ message: 'La fecha de término calculada cae en fin de semana' }); return; }
      const fFin = await feriadosEnRango(fecha_fin, fecha_fin);
      if (fFin.length > 0) { res.status(400).json({ message: mensajeFeriado(fFin[0]) }); return; }
      const overlap = await matrimonioService.checkOverlap(userId, fecha_inicio, fecha_fin);
      if (overlap) { res.status(400).json({ message: 'Ya tienes un permiso registrado para esa fecha' }); return; }
      const permiso = await matrimonioService.create({ user_id: userId, fecha_inicio, fecha_fin, motivo });
      try { await auditLogService.register(req, 'create', 'permiso_matrimonio', permiso.id, `Solicitó permiso matrimonio: ${fecha_inicio} - ${fecha_fin}`); } catch {}
      res.status(201).json(permiso);
    } catch { res.status(500).json({ message: 'Error al solicitar permiso de matrimonio' }); }
  },

  async solicitarParaUsuario(req: Request, res: Response) {
    try {
      const { user_id, fecha_inicio, motivo } = req.body;
      if (!user_id || !fecha_inicio || !motivo) { res.status(400).json({ message: 'Usuario, fecha inicio y motivo son requeridos' }); return; }
      if (isWeekend(fecha_inicio)) { res.status(400).json({ message: 'La fecha de inicio no puede ser fin de semana' }); return; }
      const fIni = await feriadosEnRango(fecha_inicio, fecha_inicio);
      if (fIni.length > 0) { res.status(400).json({ message: mensajeFeriado(fIni[0]) }); return; }
      const { userRepository } = require('../repositories/user.repository');
      const targetUser = await userRepository.findById(user_id);
      if (!targetUser) { res.status(404).json({ message: 'Usuario no encontrado' }); return; }
      const fecha_fin = await calcularFechaFin(fecha_inicio);
      if (isWeekend(fecha_fin)) { res.status(400).json({ message: 'La fecha de término calculada cae en fin de semana' }); return; }
      const fFin = await feriadosEnRango(fecha_fin, fecha_fin);
      if (fFin.length > 0) { res.status(400).json({ message: mensajeFeriado(fFin[0]) }); return; }
      const overlap = await matrimonioService.checkOverlap(user_id, fecha_inicio, fecha_fin);
      if (overlap) { res.status(400).json({ message: 'El usuario ya tiene un permiso registrado para esa fecha' }); return; }
      const permiso = await matrimonioService.create({ user_id, fecha_inicio, fecha_fin, motivo });
      try { await auditLogService.register(req, 'create_for_user', 'permiso_matrimonio', permiso.id, `Registró permiso matrimonio para usuario #${user_id}`); } catch {}
      res.status(201).json(permiso);
    } catch { res.status(500).json({ message: 'Error al registrar permiso de matrimonio' }); }
  },

  async listarTodos(_req: Request, res: Response) {
    try { const permisos = await matrimonioService.findAll(); res.json(permisos); } catch { res.status(500).json({ message: 'Error al obtener permisos' }); }
  },

  async getByUserId(req: Request, res: Response) {
    try { const userId = parseInt(req.params.userId); const permisos = await matrimonioService.findByUserId(userId); res.json({ permisos }); } catch { res.status(500).json({ message: 'Error al obtener permisos' }); }
  },

  async aprobar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permiso = await matrimonioService.updateEstado(id, 'aprobado');
      if (!permiso) { res.status(404).json({ message: 'Permiso no encontrado' }); return; }
      try { await auditLogService.register(req, 'approve', 'permiso_matrimonio', id, `Aprobó permiso matrimonio #${id}`); } catch {}
      res.json(permiso);
    } catch { res.status(500).json({ message: 'Error al aprobar permiso' }); }
  },

  async rechazar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { motivo_rechazo } = req.body;
      if (!motivo_rechazo) { res.status(400).json({ message: 'Motivo de rechazo requerido' }); return; }
      const permiso = await matrimonioService.updateEstado(id, 'rechazado', motivo_rechazo);
      if (!permiso) { res.status(404).json({ message: 'Permiso no encontrado' }); return; }
      try { await auditLogService.register(req, 'reject', 'permiso_matrimonio', id, `Rechazó permiso matrimonio #${id}`); } catch {}
      res.json(permiso);
    } catch { res.status(500).json({ message: 'Error al rechazar permiso' }); }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permiso = await matrimonioService.findById(id);
      if (!permiso) { res.status(404).json({ message: 'Permiso no encontrado' }); return; }
      if (permiso.estado !== 'en_revision') { res.status(400).json({ message: 'Solo se pueden editar permisos en estado En Revisión' }); return; }
      const { fecha_inicio, motivo } = req.body;
      let fecha_fin: string | undefined;
      if (fecha_inicio !== undefined) {
        if (isWeekend(fecha_inicio)) { res.status(400).json({ message: 'La fecha de inicio no puede ser fin de semana' }); return; }
        const fIni = await feriadosEnRango(fecha_inicio, fecha_inicio);
        if (fIni.length > 0) { res.status(400).json({ message: mensajeFeriado(fIni[0]) }); return; }
        fecha_fin = await calcularFechaFin(fecha_inicio);
        const overlap = await matrimonioService.checkOverlap(permiso.user_id, fecha_inicio, fecha_fin, id);
        if (overlap) { res.status(400).json({ message: 'Ya existe un permiso en ese rango' }); return; }
      }
      const updated = await matrimonioService.update(id, { fecha_inicio, fecha_fin, motivo });
      try { await auditLogService.register(req, 'update', 'permiso_matrimonio', id, `Editó permiso matrimonio #${id}`); } catch {}
      res.json(updated);
    } catch { res.status(500).json({ message: 'Error al editar permiso' }); }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permiso = await matrimonioService.findById(id);
      if (!permiso) { res.status(404).json({ message: 'Permiso no encontrado' }); return; }
      if (req.user!.rolId !== 1) {
        if (permiso.estado === 'aprobado') { res.status(400).json({ message: 'No se puede eliminar un permiso aprobado' }); return; }
        if (new Date(permiso.fecha_inicio) < new Date()) { res.status(400).json({ message: 'No se puede eliminar un permiso con fecha anterior a hoy' }); return; }
      }
      await matrimonioService.delete(id);
      try { await auditLogService.register(req, 'delete', 'permiso_matrimonio', id, `Eliminó permiso matrimonio #${id}`); } catch {}
      res.json({ message: 'Permiso eliminado' });
    } catch { res.status(500).json({ message: 'Error al eliminar permiso' }); }
  },

  async info(req: Request, res: Response) {
    try {
      const { fecha_inicio } = req.query as any;
      let fecha_fin: string | undefined;
      if (fecha_inicio && !isWeekend(fecha_inicio)) {
        const f = await feriadosEnRango(fecha_inicio, fecha_inicio);
        if (f.length === 0) fecha_fin = await calcularFechaFin(fecha_inicio);
      }
      res.json({ dias: DIAS_MATRIMONIO, fecha_fin });
    } catch { res.status(500).json({ message: 'Error' }); }
  },

  async subirComprobante(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permiso = await matrimonioService.findById(id);
      if (!permiso) { res.status(404).json({ message: 'Permiso no encontrado' }); return; }
      if (permiso.estado !== 'aprobado') { res.status(400).json({ message: 'El permiso debe estar aprobado para subir un comprobante' }); return; }
      uploadMatrimonioComprobanteMiddleware(req, res, async (err: any) => {
        if (err) { res.status(400).json({ message: err.message || 'Error al subir archivo' }); return; }
        if (!req.file) { res.status(400).json({ message: 'Debe seleccionar un archivo' }); return; }
        const comprobanteUrl = `comprobantes/${req.file.filename}`;
        if (permiso.comprobante_url) {
          const prev = path.resolve(UPLOADS_DIR, '..', permiso.comprobante_url);
          if (fs.existsSync(prev)) fs.unlinkSync(prev);
        }
        const updated = await matrimonioService.saveComprobante(id, comprobanteUrl);
        try { await auditLogService.register(req, 'update', 'permiso_matrimonio', id, `Subió comprobante matrimonio #${id}`); } catch {}
        res.json(updated);
      });
    } catch { res.status(500).json({ message: 'Error al subir comprobante' }); }
  },

  async descargarComprobante(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const permiso = await matrimonioService.findById(id);
      if (!permiso) { res.status(404).json({ message: 'Permiso no encontrado' }); return; }
      if (!permiso.comprobante_url) { res.status(404).json({ message: 'No hay comprobante para este permiso' }); return; }
      const filePath = path.resolve(UPLOADS_DIR, '..', permiso.comprobante_url);
      if (!fs.existsSync(filePath)) { res.status(404).json({ message: 'Archivo no encontrado en el servidor' }); return; }
      res.sendFile(filePath);
    } catch { res.status(500).json({ message: 'Error al descargar comprobante' }); }
  },
};
