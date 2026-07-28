import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { LogIn, ShieldCheck, Key, Mail, X } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [step, setStep] = useState<'login' | '2fa'>('login');
  const [userId, setUserId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password, twoFactorToken || undefined);
      if (result.requires2FA) {
        setUserId(result.userId);
        setStep('2fa');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      await authApi.forgotPassword(forgotEmail);
      setForgotSuccess(true);
    } catch (err: any) {
      setForgotError(err.response?.data?.message || 'Error al solicitar restablecimiento');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setForgotEmail('');
    setForgotError('');
    setForgotSuccess(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-200">
        <div className="text-center mb-8">
          <img 
            src="/logo.webp" 
            alt="Escuela Blanca Estela Prat" 
            className="w-32 h-32 mx-auto mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-gray-800">PermisosBE</h1>
          <p className="text-gray-500 mt-2">Sistema de Permisos Administrativos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 'login' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código 2FA</label>
              <input
                type="text"
                value={twoFactorToken}
                onChange={(e) => setTwoFactorToken(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Ingrese el código de 6 dígitos"
                required
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : step === 'login' ? <><LogIn className="w-4 h-4" /> Ingresar</> : <><ShieldCheck className="w-4 h-4" /> Verificar</>}
          </button>
        </form>

        {step === 'login' && (
          <div className="mt-4 text-center">
            <button onClick={() => setForgotOpen(true)} className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
              ¿Olvidó su contraseña?
            </button>
          </div>
        )}
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative">
            <button onClick={closeForgot} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <Key className="w-10 h-10 text-amber-600 mx-auto mb-2" />
              <h2 className="text-xl font-bold text-gray-800">Restablecer Contraseña</h2>
            </div>

            {forgotSuccess ? (
              <div className="text-center space-y-4">
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
                  Si el email está registrado y tiene habilitado el cambio de contraseña, recibirás un enlace de restablecimiento en tu correo.
                </div>
                <button
                  onClick={closeForgot}
                  className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Registrado</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                </div>

                {forgotError && (
                  <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{forgotError}</div>
                )}

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" /> {forgotLoading ? 'Enviando...' : 'Enviar enlace de restablecimiento'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
