import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import Login from '../pages/Login';

describe('Login Page', () => {
  it('renders login form', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('PermisosBE')).toBeDefined();
    expect(screen.getByText('Sistema de Permisos Administrativos')).toBeDefined();
  });

  it('has username and password fields', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('Usuario')).toBeDefined();
    expect(screen.getByText('Contraseña')).toBeDefined();
  });
});
