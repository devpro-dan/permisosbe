import pool from '../config/database';
import { SystemConfig } from '../types';

export const systemConfigRepository = {
  async findByClave(clave: string): Promise<SystemConfig | null> {
    const result = await pool.query(
      'SELECT * FROM system_config WHERE clave = $1',
      [clave]
    );
    return result.rows[0] || null;
  },

  async findAll(): Promise<SystemConfig[]> {
    const result = await pool.query('SELECT * FROM system_config ORDER BY clave ASC');
    return result.rows;
  },

  async set(clave: string, valor: string, descripcion?: string): Promise<SystemConfig> {
    const result = await pool.query(
      `INSERT INTO system_config (clave, valor, descripcion) 
       VALUES ($1, $2, $3)
       ON CONFLICT (clave)
       DO UPDATE SET valor = $2, descripcion = COALESCE($3, system_config.descripcion), updated_at = NOW()
       RETURNING *`,
      [clave, valor, descripcion]
    );
    return result.rows[0];
  },

  async delete(clave: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM system_config WHERE clave = $1', [clave]);
    return result.rowCount !== null && result.rowCount > 0;
  },
};
