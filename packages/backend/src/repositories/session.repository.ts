import pool from '../config/database';
import { Session } from '../types';

export const sessionRepository = {
  async create(userId: number, token: string, expiresAt: Date): Promise<Session> {
    const result = await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING *`,
      [userId, token, expiresAt]
    );
    return result.rows[0];
  },

  async findByToken(token: string): Promise<Session | null> {
    const result = await pool.query(
      'SELECT * FROM sessions WHERE token = $1',
      [token]
    );
    return result.rows[0] || null;
  },

  async findByUserId(userId: number): Promise<Session[]> {
    const result = await pool.query(
      'SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  },

  async findAll(): Promise<Session[]> {
    const result = await pool.query(
      `SELECT s.*, u.username, u.nombres, u.apellido_paterno 
       FROM sessions s 
       JOIN users u ON u.id = s.user_id 
       ORDER BY s.created_at DESC`
    );
    return result.rows;
  },

  async deleteById(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  },

  async deleteExpired(): Promise<void> {
    await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
  },

  async updateActivity(id: number): Promise<void> {
    await pool.query(
      'UPDATE sessions SET last_activity = NOW() WHERE id = $1',
      [id]
    );
  },
};
