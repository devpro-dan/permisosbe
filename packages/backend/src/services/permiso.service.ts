import pool from '../config/database';
import { systemConfigRepository } from '../repositories/systemConfig.repository';
import { PermisoAdministrativo } from '../types';
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

export const permisoService = {
  async getAvailablePermisos(userId: number) {
    const config = await systemConfigRepository.findByClave('permisos_por_anio');
    const maxDias = parseInt(config?.valor || '6', 10);
    const currentYear = new Date().getFullYear();
    const result = await pool.query(
      `SELECT fecha_inicio, fecha_fin, tipo_jornada FROM permisos_administrativos
       WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_solicitud) = $2 AND estado != 'rechazado'`,
      [userId, currentYear]
    );
    let used = 0;
    for (const p of result.rows) {
      const d1 = new Date(p.fecha_inicio + 'T12:00:00');
      const d2 = new Date((p.fecha_fin || p.fecha_inicio) + 'T12:00:00');
      let count = 0;
      const cur = new Date(d1);
      while (cur <= d2) { const day = cur.getDay(); if (day !== 0 && day !== 6) count++; cur.setDate(cur.getDate() + 1); }
      if (count === 0) count = 1;
      const dias = p.tipo_jornada === 'media' ? count * 0.5 : count;
      used += dias;
    }
    used = Math.round(used * 10) / 10;
    const available = Math.max(0, Math.round((maxDias - used) * 10) / 10);
    return { max: maxDias, used, available };
  },

  async findByUser(userId: number) {
    const result = await pool.query(
      'SELECT * FROM permisos_administrativos WHERE user_id = $1 ORDER BY fecha_solicitud DESC',
      [userId]
    );
    return result.rows.map(addComprobanteStatus);
  },

  async findAll() {
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo
       FROM permisos_administrativos p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.fecha_solicitud DESC`
    );
    return result.rows.map(addComprobanteStatus);
  },

  async findByUserId(userId: number) {
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo
       FROM permisos_administrativos p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1
       ORDER BY p.fecha_solicitud DESC`,
      [userId]
    );
    return result.rows.map(addComprobanteStatus);
  },

  async checkOverlap(userId: number, fechaInicio: string, fechaFin?: string, excludeId?: number): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM permisos_administrativos
       WHERE user_id = $1 AND estado != 'rechazado'
         AND fecha_inicio <= $3 AND COALESCE(fecha_fin, fecha_inicio) >= $2
         AND ($4::int IS NULL OR id != $4)
       LIMIT 1`,
      [userId, fechaInicio, fechaFin || fechaInicio, excludeId || null]
    );
    return result.rows.length > 0;
  },

  async create(data: {
    user_id: number;
    fecha_inicio: string;
    fecha_fin?: string;
    tipo_jornada: 'completa' | 'media';
    motivo: string;
  }): Promise<PermisoAdministrativo> {
    const result = await pool.query(
      `INSERT INTO permisos_administrativos (user_id, fecha_inicio, fecha_fin, tipo_jornada, estado, motivo)
       VALUES ($1, $2, $3, $4, 'en_revision', $5) RETURNING *`,
      [data.user_id, data.fecha_inicio, data.fecha_fin || null, data.tipo_jornada, data.motivo]
    );
    return result.rows[0];
  },

  async saveComprobante(id: number, comprobanteUrl: string) {
    const result = await pool.query(
      'UPDATE permisos_administrativos SET comprobante_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [comprobanteUrl, id]
    );
    return result.rows[0] ? addComprobanteStatus(result.rows[0]) : null;
  },

  async updateEstado(id: number, estado: string, motivoRechazo?: string) {
    const result = await pool.query(
      `UPDATE permisos_administrativos SET estado = $1, motivo_rechazo = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [estado, motivoRechazo || null, id]
    );
    return result.rows[0] || null;
  },

  async update(id: number, data: Partial<PermisoAdministrativo>) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id' && key !== 'created_at' && key !== 'fecha_solicitud' && key !== 'user_id' && key !== 'estado') {
        fields.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE permisos_administrativos SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  async delete(id: number) {
    const result = await pool.query('DELETE FROM permisos_administrativos WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  },

  async findById(id: number) {
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo, u.email
       FROM permisos_administrativos p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async getYearlyPermisos(userId: number, year: number) {
    const result = await pool.query(
      `SELECT * FROM permisos_administrativos 
       WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_solicitud) = $2
       ORDER BY fecha_solicitud DESC`,
      [userId, year]
    );
    return result.rows;
  },

  async getAnosDisponibles(userId: number): Promise<number[]> {
    const result = await pool.query(
      `SELECT DISTINCT EXTRACT(YEAR FROM fecha_solicitud)::int AS year
       FROM permisos_administrativos WHERE user_id = $1 ORDER BY year DESC`,
      [userId]
    );
    const years = result.rows.map((r: any) => r.year);
    const current = new Date().getFullYear();
    if (!years.includes(current)) years.unshift(current);
    return years;
  },

  async getResumenTrabajadores(filters: { employee?: string; startDate?: string; endDate?: string; year?: number; cargo?: string }) {
    const config = await systemConfigRepository.findByClave('permisos_por_anio');
    const maxDias = parseInt(config?.valor || '6', 10);

    const permisosConditions: string[] = [`p.estado = 'aprobado'`];
    const permisosValues: unknown[] = [];
    let index = 1;

    if (filters.year) {
      permisosConditions.push(`EXTRACT(YEAR FROM p.fecha_solicitud) = $${index}`);
      permisosValues.push(filters.year);
      index++;
    }
    if (filters.startDate) {
      permisosConditions.push(`COALESCE(p.fecha_fin, p.fecha_inicio) >= $${index}`);
      permisosValues.push(filters.startDate);
      index++;
    }
    if (filters.endDate) {
      permisosConditions.push(`p.fecha_inicio <= $${index}`);
      permisosValues.push(filters.endDate);
      index++;
    }

    const permisosResult = await pool.query(
      `SELECT p.user_id, p.fecha_inicio, p.fecha_fin, p.tipo_jornada
       FROM permisos_administrativos p
       WHERE ${permisosConditions.join(' AND ')}`,
      permisosValues
    );

    const usedByUser: Record<number, number> = {};
    for (const p of permisosResult.rows) {
      const d1 = new Date(p.fecha_inicio + 'T12:00:00');
      const d2 = new Date((p.fecha_fin || p.fecha_inicio) + 'T12:00:00');
      const diffDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
      const dias = p.tipo_jornada === 'media' ? diffDays * 0.5 : diffDays;
      usedByUser[p.user_id] = (usedByUser[p.user_id] || 0) + dias;
    }

    const userConditions: string[] = [];
    const userValues: unknown[] = [];
    let userIndex = 1;
    if (filters.employee) {
      userConditions.push(`(nombres || ' ' || apellido_paterno ILIKE $${userIndex} OR rut || '-' || dv ILIKE $${userIndex})`);
      userValues.push(`%${filters.employee}%`);
      userIndex++;
    }
    if (filters.cargo) {
      userConditions.push(`cargo ILIKE $${userIndex}`);
      userValues.push(`%${filters.cargo}%`);
      userIndex++;
    }

    const usersResult = await pool.query(
      `SELECT id, nombres, apellido_paterno, apellido_materno, rut, dv, cargo
       FROM users
       ${userConditions.length > 0 ? `WHERE ${userConditions.join(' AND ')}` : ''}
       ORDER BY apellido_paterno ASC, nombres ASC`,
      userValues
    );

    return {
      maxDias,
      trabajadores: usersResult.rows.map((u) => {
        const usados = Math.round((usedByUser[u.id] || 0) * 10) / 10;
        const disponibles = Math.max(0, Math.round((maxDias - usados) * 10) / 10);
        return { ...u, maxDias, dias_usados: usados, dias_disponibles: disponibles };
      }),
    };
  },

  async getPermisosDelMes(month: string) {
    const [year, mes] = month.split('-');
    const start = `${year}-${mes}-01`;
    const lastDay = new Date(parseInt(year, 10), parseInt(mes, 10), 0).getDate();
    const end = `${year}-${mes}-${String(lastDay).padStart(2, '0')}`;

    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno
       FROM permisos_administrativos p
       JOIN users u ON u.id = p.user_id
       WHERE p.estado = 'aprobado'
         AND p.fecha_inicio <= $1
         AND COALESCE(p.fecha_fin, p.fecha_inicio) >= $2
       ORDER BY u.apellido_paterno ASC, u.nombres ASC, p.fecha_inicio ASC`,
      [end, start]
    );

    const fmt = (v: string) => {
      const [y, m, d] = v.split('-');
      return `${d}/${m}/${y}`;
    };

    return result.rows.map((p) => {
      const d1 = Math.max(new Date(p.fecha_inicio + 'T12:00:00').getTime(), new Date(start + 'T12:00:00').getTime());
      const d2 = Math.min(new Date((p.fecha_fin || p.fecha_inicio) + 'T12:00:00').getTime(), new Date(end + 'T12:00:00').getTime());
      const diffDays = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
      const dias = p.tipo_jornada === 'media' ? diffDays * 0.5 : diffDays;
      const diasStr = dias === 0.5 ? 'media' : Number.isInteger(dias) ? String(dias) : String(Math.round(dias * 10) / 10).replace('.', ',');
      return {
        nombre: `${p.nombres} ${p.apellido_paterno}${p.apellido_materno ? ` ${p.apellido_materno}` : ''}`.trim(),
        dias: diasStr,
        desde: fmt(p.fecha_inicio),
        hasta: p.fecha_fin ? fmt(p.fecha_fin) : fmt(p.fecha_inicio),
        observaciones: p.motivo,
      };
    });
  },

  async findForReport(filters: { employee?: string; startDate?: string; endDate?: string; year?: number; cargo?: string }) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (filters.employee) {
      conditions.push(`(u.nombres || ' ' || u.apellido_paterno ILIKE $${index} OR u.rut || '-' || u.dv ILIKE $${index})`);
      values.push(`%${filters.employee}%`);
      index++;
    }
    if (filters.cargo) {
      conditions.push(`u.cargo ILIKE $${index}`);
      values.push(`%${filters.cargo}%`);
      index++;
    }
    if (filters.startDate) {
      conditions.push(`COALESCE(p.fecha_fin, p.fecha_inicio) >= $${index}`);
      values.push(filters.startDate);
      index++;
    }
    if (filters.endDate) {
      conditions.push(`p.fecha_inicio <= $${index}`);
      values.push(filters.endDate);
      index++;
    }
    if (filters.year) {
      conditions.push(`EXTRACT(YEAR FROM p.fecha_solicitud) = $${index}`);
      values.push(filters.year);
      index++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo
       FROM permisos_administrativos p
       JOIN users u ON u.id = p.user_id
       ${where}
       ORDER BY p.fecha_inicio DESC, u.apellido_paterno ASC`,
      values
    );
    return result.rows;
  },

  async getDashboardIndicadores() {
    const config = await systemConfigRepository.findByClave('permisos_por_anio');
    const max = parseInt(config?.valor || '6', 10);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startMes = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endMes = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [pendientesRes, mesRes, yearlyRes, usersRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as c FROM permisos_administrativos WHERE estado='en_revision'`),
      pool.query(
        `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo
         FROM permisos_administrativos p JOIN users u ON u.id=p.user_id
         WHERE p.fecha_inicio >= $1 AND p.fecha_inicio <= $2 AND p.estado != 'rechazado'`,
        [startMes, endMes]
      ),
      pool.query(`SELECT user_id, fecha_inicio, fecha_fin, tipo_jornada FROM permisos_administrativos WHERE EXTRACT(YEAR FROM fecha_solicitud)=$1 AND estado != 'rechazado'`, [year]),
      pool.query(`SELECT id, nombres, apellido_paterno, apellido_materno, rut, dv, cargo FROM users WHERE COALESCE(is_suspended,false)=false ORDER BY apellido_paterno`),
    ]);

    const calcDias = (p: any): number => {
      const d1 = new Date(p.fecha_inicio + 'T12:00:00');
      const d2 = new Date((p.fecha_fin || p.fecha_inicio) + 'T12:00:00');
      let count = 0;
      const cur = new Date(d1);
      while (cur <= d2) { const day = cur.getDay(); if (day !== 0 && day !== 6) count++; cur.setDate(cur.getDate() + 1); }
      if (count === 0) count = 1;
      return p.tipo_jornada === 'media' ? count * 0.5 : count;
    };

    const byUserMes: Record<number, { user: any; count: number; dias: number }> = {};
    for (const p of mesRes.rows) {
      const uid = p.user_id;
      if (!byUserMes[uid]) byUserMes[uid] = { user: { id: uid, nombres: p.nombres, apellido_paterno: p.apellido_paterno, apellido_materno: p.apellido_materno, rut: p.rut, dv: p.dv, cargo: p.cargo }, count: 0, dias: 0 };
      byUserMes[uid].count += 1;
      byUserMes[uid].dias += calcDias(p);
    }
    const rankingMes = Object.values(byUserMes).sort((a, b) => b.count - a.count || b.dias - a.dias).slice(0, 5);
    const topMes = rankingMes[0] || null;

    const usedMap: Record<number, number> = {};
    for (const r of yearlyRes.rows) {
      const d1 = new Date(r.fecha_inicio + 'T12:00:00');
      const d2 = new Date((r.fecha_fin || r.fecha_inicio) + 'T12:00:00');
      let count = 0;
      const cur = new Date(d1);
      while (cur <= d2) { const day = cur.getDay(); if (day !== 0 && day !== 6) count++; cur.setDate(cur.getDate() + 1); }
      if (count === 0) count = 1;
      const dias = r.tipo_jornada === 'media' ? count * 0.5 : count;
      usedMap[r.user_id] = Math.round(((usedMap[r.user_id] || 0) + dias) * 10) / 10;
    }

    const agotados: any[] = [];
    const porAgotarse: any[] = [];
    for (const u of usersRes.rows) {
      const usados = Math.round((usedMap[u.id] || 0) * 10) / 10;
      const disponibles = Math.max(0, Math.round((max - usados) * 10) / 10);
      if (disponibles === 0 && usados > 0) agotados.push({ ...u, usados, disponibles, max });
      else if (disponibles === 0.5 || disponibles === 1) porAgotarse.push({ ...u, usados, disponibles, max });
    }

    const aprobadosMesRes = await pool.query(`SELECT COUNT(*)::int as c FROM permisos_administrativos WHERE estado='aprobado' AND fecha_inicio >= $1 AND fecha_inicio <= $2`, [startMes, endMes]);
    const rechazadosMesRes = await pool.query(`SELECT COUNT(*)::int as c FROM permisos_administrativos WHERE estado='rechazado' AND fecha_inicio >= $1 AND fecha_inicio <= $2`, [startMes, endMes]);

    return {
      max,
      year,
      month,
      pendientes: pendientesRes.rows[0].c,
      aprobadosMes: aprobadosMesRes.rows[0].c,
      rechazadosMes: rechazadosMesRes.rows[0].c,
      topMes,
      rankingMes,
      agotados,
      porAgotarse,
      totalUsuarios: usersRes.rows.length,
    };
  },
};
