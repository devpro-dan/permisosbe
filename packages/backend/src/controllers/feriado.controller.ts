import { Request, Response } from 'express';
import { feriadoRepository } from '../repositories/feriado.repository';
import { auditLogService } from '../services/auditLog.service';

function validarFecha(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !isNaN(new Date(`${fecha}T12:00:00`).getTime());
}

export const feriadoController = {
  async list(req: Request, res: Response) {
    try {
      const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
      let feriados = await feriadoRepository.findAll();
      if (year) {
        feriados = feriados.filter((f) => f.fecha.startsWith(`${year}-`));
      }
      res.json(feriados);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener feriados' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { fecha, descripcion } = req.body;
      if (!fecha || !validarFecha(fecha)) {
        res.status(400).json({ message: 'Fecha inválida, use formato AAAA-MM-DD' });
        return;
      }
      if (!descripcion) {
        res.status(400).json({ message: 'Descripción requerida' });
        return;
      }
      const feriado = await feriadoRepository.create(fecha, descripcion.trim());
      await auditLogService.register(req, 'create', 'feriado', feriado.id, `Creó feriado: ${fecha} - ${descripcion}`);
      res.status(201).json(feriado);
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(400).json({ message: 'Ya existe un feriado para esa fecha' });
        return;
      }
      res.status(500).json({ message: 'Error al crear feriado' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { fecha, descripcion } = req.body;
      if (!fecha || !validarFecha(fecha)) {
        res.status(400).json({ message: 'Fecha inválida, use formato AAAA-MM-DD' });
        return;
      }
      if (!descripcion) {
        res.status(400).json({ message: 'Descripción requerida' });
        return;
      }
      const feriado = await feriadoRepository.update(id, fecha, descripcion.trim());
      if (!feriado) {
        res.status(404).json({ message: 'Feriado no encontrado' });
        return;
      }
      await auditLogService.register(req, 'update', 'feriado', id, `Editó feriado: ${fecha} - ${descripcion}`);
      res.json(feriado);
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(400).json({ message: 'Ya existe un feriado para esa fecha' });
        return;
      }
      res.status(500).json({ message: 'Error al actualizar feriado' });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const deleted = await feriadoRepository.delete(id);
      if (!deleted) {
        res.status(404).json({ message: 'Feriado no encontrado' });
        return;
      }
      await auditLogService.register(req, 'delete', 'feriado', id, `Eliminó feriado #${id}`);
      res.json({ message: 'Feriado eliminado' });
    } catch (error) {
      res.status(500).json({ message: 'Error al eliminar feriado' });
    }
  },
};
