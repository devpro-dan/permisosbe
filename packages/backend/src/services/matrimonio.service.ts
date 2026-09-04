import pool from '../config/database';
import fs from 'fs';
import path from 'path';

const COMPROBANTES_DIR = path.resolve(
  (() => {
    if (process.env.UPLOADS_PATH) return process.env.UPLOADS_PATH;
    const cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, 'packages'))) return path.join(cwd, 'uploads', 'comprobantes');
    return path.join(cwd, 'uploads', 'comprobantes');
  })()
);

function addComprobanteStatus<T extends { comprobante_url?: string | null }>(permiso: T) {
  return {
    ...permiso,
    comprobante_disponible: Boolean(permiso.comprobante_url && fs.existsSync(path.resolve(COMPROBANTES_DIR, '..', permiso.comprobante_url))),
  };
}

export const DIAS_MATRIMONIO = 5;

export function calcularFechaFinMatrimonio(fechaInicio: string, feriados: Set<string>): string {
  let cur = new Date(fechaInicio + 'T12:00:00');
  let remaining = DIAS_MATRIMONIO - 1;
  let safety = 0;
  while (remaining > 0 && safety < 60) {
    cur.setDate(cur.getDate() + 1);
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    const day = cur.getDay();
    if (day === 0 || day === 6) { safety++; continue; }
    if (feriados.has(iso)) { safety++; continue; }
    remaining--; safety++;
  }
  return `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
}

export const matrimonioService = {
  DIAS_MATRIMONIO,

  calcularFechaFin: calcularFechaFinMatrimonio,

  async findByUser(userId: number) {
    const result = await pool.query('SELECT * FROM permisos_matrimonio WHERE user_id = $1 ORDER BY fecha_solicitud DESC', [userId]);
    return result.rows.map(addComprobanteStatus);
  },

  async findAll() {
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo
       FROM permisos_matrimonio p JOIN users u ON u.id = p.user_id ORDER BY p.fecha_solicitud DESC`
    );
    return result.rows.map(addComprobanteStatus);
  },

  async findByUserId(userId: number) {
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo
       FROM permisos_matrimonio p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1 ORDER BY p.fecha_solicitud DESC`,
      [userId]
    );
    return result.rows.map(addComprobanteStatus);
  },

  async findById(id: number) {
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo, u.email
       FROM permisos_matrimonio p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async checkOverlap(userId: number, fechaInicio: string, fechaFin: string, excludeId?: number): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM permisos_matrimonio WHERE user_id = $1 AND estado != 'rechazado'
        AND fecha_inicio <= $3 AND fecha_fin >= $2 AND ($4::int IS NULL OR id != $4) LIMIT 1`,
      [userId, fechaInicio, fechaFin, excludeId || null]
    );
    if (result.rows.length > 0) return true;
    const result2 = await pool.query(
      `SELECT id FROM permisos_administrativos WHERE user_id = $1 AND estado != 'rechazado'
        AND fecha_inicio <= $3 AND COALESCE(fecha_fin, fecha_inicio) >= $2 LIMIT 1`,
      [userId, fechaInicio, fechaFin]
    );
    return result2.rows.length > 0;
  },

  async create(data: { user_id: number; fecha_inicio: string; fecha_fin: string; motivo: string }) {
    const result = await pool.query(
      `INSERT INTO permisos_matrimonio (user_id, fecha_inicio, fecha_fin, estado, motivo)
       VALUES ($1, $2, $3, 'en_revision', $4) RETURNING *`,
      [data.user_id, data.fecha_inicio, data.fecha_fin, data.motivo]
    );
    return result.rows[0];
  },

  async updateEstado(id: number, estado: string, motivoRechazo?: string) {
    const result = await pool.query(
      `UPDATE permisos_matrimonio SET estado = $1, motivo_rechazo = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [estado, motivoRechazo || null, id]
    );
    return result.rows[0] || null;
  },

  async update(id: number, data: { fecha_inicio?: string; fecha_fin?: string; motivo?: string }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }
    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');
    values.push(id);
    const result = await pool.query(
      `UPDATE permisos_matrimonio SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  async delete(id: number) {
    const result = await pool.query('DELETE FROM permisos_matrimonio WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  },

  async saveComprobante(id: number, comprobanteUrl: string) {
    const result = await pool.query(
      'UPDATE permisos_matrimonio SET comprobante_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [comprobanteUrl, id]
    );
    return result.rows[0] ? addComprobanteStatus(result.rows[0]) : null;
  },

  async getAnosDisponibles(userId: number): Promise<number[]> {
    const result = await pool.query(
      `SELECT DISTINCT EXTRACT(YEAR FROM fecha_solicitud)::int AS year FROM permisos_matrimonio WHERE user_id = $1 ORDER BY year DESC`,
      [userId]
    );
    const years = result.rows.map((r: any) => r.year);
    const current = new Date().getFullYear();
    if (!years.includes(current)) years.unshift(current);
    return years;
  },

  async findForReport(filters: { employee?: string; startDate?: string; endDate?: string; year?: number; cargo?: string }) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;
    if (filters.employee) { conditions.push(`(u.nombres || ' ' || u.apellido_paterno ILIKE $${index} OR u.rut || '-' || u.dv ILIKE $${index})`); values.push(`%${filters.employee}%`); index++; }
    if (filters.cargo) { conditions.push(`u.cargo ILIKE $${index}`); values.push(`%${filters.cargo}%`); index++; }
    if (filters.startDate) { conditions.push(`p.fecha_fin >= $${index}`); values.push(filters.startDate); index++; }
    if (filters.endDate) { conditions.push(`p.fecha_inicio <= $${index}`); values.push(filters.endDate); index++; }
    if (filters.year) { conditions.push(`EXTRACT(YEAR FROM p.fecha_solicitud) = $${index}`); values.push(filters.year); index++; }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo FROM permisos_matrimonio p JOIN users u ON u.id = p.user_id ${where} ORDER BY p.fecha_inicio DESC, u.apellido_paterno ASC`,
      values
    );
    return result.rows.map((r: any) => ({ ...r, _tipo: 'matrimonio', tipo_jornada: 'completa' }));
  },

  async getPermisosDelMes(month: string) {
    const [year, mes] = month.split('-');
    const start = `${year}-${mes}-01`;
    const lastDay = new Date(parseInt(year, 10), parseInt(mes, 10), 0).getDate();
    const end = `${year}-${mes}-${String(lastDay).padStart(2, '0')}`;
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno FROM permisos_matrimonio p JOIN users u ON u.id = p.user_id WHERE p.estado = 'aprobado' AND p.fecha_inicio <= $1 AND p.fecha_fin >= $2 ORDER BY u.apellido_paterno ASC, u.nombres ASC, p.fecha_inicio ASC`,
      [end, start]
    );
    const fmt = (v: string) => { const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`; };
    return result.rows.map((p: any) => ({ nombre: `${p.nombres} ${p.apellido_paterno}${p.apellido_materno ? ` ${p.apellido_materno}` : ''}`.trim(), dias: '5', desde: fmt(p.fecha_inicio), hasta: fmt(p.fecha_fin), observaciones: p.motivo, _tipo: 'matrimonio' }));
  },
};
