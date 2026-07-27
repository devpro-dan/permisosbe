import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { sessionRepository } from '../repositories/session.repository';
import { systemConfigRepository } from '../repositories/systemConfig.repository';
import pool from '../config/database';
import { JwtPayload } from '../types';

export const authService = {
  async login(username: string, password: string) {
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    if (user.is_suspended) {
      throw new Error('Usuario suspendido. Contacte al administrador');
    }

    const dayConfig = await systemConfigRepository.findByClave('dias_acceso');
    if (dayConfig) {
      const allowedDays = dayConfig.valor.split(',').map(Number);
      const today = new Date().getDay();
      const jsDay = today === 0 ? 7 : today;
      if (!allowedDays.includes(jsDay)) {
        throw new Error('No está permitido acceder al sistema en este día');
      }
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new Error('Credenciales inválidas');
    }

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      rolId: user.rol_id,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });

    const sessionConfig = await systemConfigRepository.findByClave('duracion_sesion_minutos');
    const sessionMinutes = parseInt(sessionConfig?.valor || '120', 10);
    const expiresAt = new Date(Date.now() + sessionMinutes * 60 * 1000);

    await sessionRepository.create(user.id, token, expiresAt);

    return { token, user: { id: user.id, nombres: user.nombres, apellido_paterno: user.apellido_paterno, email: user.email, username: user.username, rolId: user.rol_id } };
  },

  async setup2FA(userId: number) {
    const secret = speakeasy.generateSecret({ name: `PermisosBE:${userId}` });
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');

    await pool.query(
      `INSERT INTO user_2fa (user_id, secret, enabled) VALUES ($1, $2, false)
       ON CONFLICT (user_id) DO UPDATE SET secret = $2, enabled = false`,
      [userId, secret.base32]
    );

    return { secret: secret.base32, qrCodeUrl };
  },

  async verify2FA(userId: number, token: string) {
    const result = await pool.query(
      'SELECT * FROM user_2fa WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('2FA no configurado');
    }

    const verified = speakeasy.totp.verify({
      secret: result.rows[0].secret,
      encoding: 'base32',
      token,
    });

    if (!verified) {
      throw new Error('Código 2FA inválido');
    }

    await pool.query(
      'UPDATE user_2fa SET enabled = true WHERE user_id = $1',
      [userId]
    );

    return { verified: true };
  },

  async validate2FA(userId: number, token: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT * FROM user_2fa WHERE user_id = $1 AND enabled = true',
      [userId]
    );

    if (result.rows.length === 0) return true;

    return speakeasy.totp.verify({
      secret: result.rows[0].secret,
      encoding: 'base32',
      token,
    });
  },

  async refreshToken(token: string) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const session = await sessionRepository.findByToken(token);
      if (!session) {
        throw new Error('Sesión no encontrada');
      }
      if (new Date() > new Date(session.expires_at)) {
        await sessionRepository.deleteById(session.id);
        throw new Error('Sesión expirada');
      }

      const newToken = jwt.sign(
        { userId: decoded.userId, username: decoded.username, rolId: decoded.rolId },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN as any }
      );

      const sessionConfig = await systemConfigRepository.findByClave('duracion_sesion_minutos');
      const sessionMinutes = parseInt(sessionConfig?.valor || '120', 10);
      const expiresAt = new Date(Date.now() + sessionMinutes * 60 * 1000);

      await sessionRepository.deleteById(session.id);
      await sessionRepository.create(decoded.userId, newToken, expiresAt);

      return { token: newToken };
    } catch (error) {
      throw new Error('Token inválido o expirado');
    }
  },
};
