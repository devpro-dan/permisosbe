import pool from '../config/database';

export interface Feriado {
  id: number;
  fecha: string;
  descripcion: string;
}

export const feriadoRepository = {
  async findEntre(inicio: string, fin: string): Promise<Feriado[]> {
    const result = await pool.query(
      'SELECT * FROM feriados WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha ASC',
      [inicio, fin]
    );
    return result.rows;
  },

  async findAll(): Promise<Feriado[]> {
    const result = await pool.query('SELECT * FROM feriados ORDER BY fecha ASC');
    return result.rows;
  },

  async findById(id: number): Promise<Feriado | null> {
    const result = await pool.query('SELECT * FROM feriados WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async create(fecha: string, descripcion: string): Promise<Feriado> {
    const result = await pool.query(
      'INSERT INTO feriados (fecha, descripcion) VALUES ($1, $2) RETURNING *',
      [fecha, descripcion]
    );
    return result.rows[0];
  },

  async update(id: number, fecha: string, descripcion: string): Promise<Feriado | null> {
    const result = await pool.query(
      'UPDATE feriados SET fecha = $1, descripcion = $2 WHERE id = $3 RETURNING *',
      [fecha, descripcion, id]
    );
    return result.rows[0] || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM feriados WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  },
};
