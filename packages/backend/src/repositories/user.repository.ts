import pool from '../config/database';
import { User } from '../types';

export const userRepository = {
  async findByUsername(username: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  },

  async findById(id: number): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async findAll(): Promise<User[]> {
    const result = await pool.query(
      `SELECT u.*, r.nombre as rol_nombre 
       FROM users u 
       LEFT JOIN roles r ON r.id = u.rol_id 
       ORDER BY u.apellido_paterno ASC`
    );
    return result.rows;
  },

  async create(data: Partial<User>): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (nombres, rut, dv, apellido_paterno, apellido_materno, titulo, cargo, email, username, password_hash, rol_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.nombres, data.rut, data.dv, data.apellido_paterno,
        data.apellido_materno, data.titulo, data.cargo, data.email,
        data.username, data.password_hash, data.rol_id,
      ]
    );
    return result.rows[0];
  },

  async update(id: number, data: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  async updateSuspension(id: number, suspended: boolean): Promise<User | null> {
    const result = await pool.query(
      'UPDATE users SET is_suspended = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [suspended, id]
    );
    return result.rows[0] || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  },
};
