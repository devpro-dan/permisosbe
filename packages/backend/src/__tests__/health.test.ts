import request from 'supertest';
import app from '../index';

describe('Health Check', () => {
  it('GET /api/health returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/nonexistent returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Ruta no encontrada');
  });
});

describe('Auth Middleware', () => {
  it('GET /api/auth/profile without token returns 401', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token de autenticación requerido');
  });
});
