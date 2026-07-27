import pool from '../config/database';
import { SystemConfig } from '../types';
import { encrypt, decrypt } from '../utils/encryption';

const SENSITIVE_KEYS = ['smtp_pass'];

export const systemConfigRepository = {
  async findByClave(clave: string): Promise<SystemConfig | null> {
    const result = await pool.query(
      'SELECT * FROM system_config WHERE clave = $1',
      [clave]
    );
    const row = result.rows[0] || null;
    if (row && SENSITIVE_KEYS.includes(clave) && row.valor) {
      try { row.valor = decrypt(row.valor); } catch { /* keep as-is */ }
    }
    return row;
  },

  async findAll(): Promise<SystemConfig[]> {
    const result = await pool.query('SELECT * FROM system_config ORDER BY clave ASC');
    return result.rows.map((row) => {
      if (SENSITIVE_KEYS.includes(row.clave) && row.valor) {
        try { row.valor = decrypt(row.valor); } catch { /* keep as-is */ }
      }
      return row;
    });
  },

  async set(clave: string, valor: string, descripcion?: string): Promise<SystemConfig> {
    const finalValor = SENSITIVE_KEYS.includes(clave) && valor ? encrypt(valor) : valor;
    const result = await pool.query(
      `INSERT INTO system_config (clave, valor, descripcion) 
       VALUES ($1, $2, $3)
       ON CONFLICT (clave)
       DO UPDATE SET valor = $2, descripcion = COALESCE($3, system_config.descripcion), updated_at = NOW()
       RETURNING *`,
      [clave, finalValor, descripcion]
    );
    const row = result.rows[0];
    if (SENSITIVE_KEYS.includes(clave) && row.valor) {
      try { row.valor = decrypt(row.valor); } catch { /* keep as-is */ }
    }
    return row;
  },

  async delete(clave: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM system_config WHERE clave = $1', [clave]);
    return result.rowCount !== null && result.rowCount > 0;
  },
};
