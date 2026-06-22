import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const MODOS = {
  LOGIN: 'login',
  REGISTRO: 'registro',
  OLVIDE: 'olvide'
};

function mensajeError(err) {
  const msg = err?.message || '';
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (msg.includes('User already registered')) return 'Ya existe una cuenta con ese email. Probá iniciar sesión.';
  if (msg.includes('Password should be at least')) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (msg.includes('Unable to validate email')) return 'Ese email no parece válido.';
  return msg || 'Algo salió mal. Probá de nuevo.';
}

export default function AuthPanel({ onAviso }) {
  const { signUp, signIn, resetPassword } = useAuth();
  const [modo, setModo] = useState(MODOS.LOGIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const limpiarMensajes = () => {
    setError('');
    setMensaje('');
  };

  const cambiarModo = (nuevoModo) => {
    setModo(nuevoModo);
    limpiarMensajes();
  };

  const handleLogin = async () => {
    limpiarMensajes();
    if (!email.trim() || !password) {
      setError('Completá email y contraseña.');
      return;
    }
    setCargando(true);
    try {
      await signIn(email.trim(), password);
      onAviso?.('Sesión iniciada');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  };

  const handleRegistro = async () => {
    limpiarMensajes();
    if (!email.trim() || !password) {
      setError('Completá email y contraseña.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setCargando(true);
    try {
      await signUp(email.trim(), password);
      setMensaje('Cuenta creada. Si tu proyecto de Supabase pide confirmar el email, revisá tu correo antes de poder iniciar sesión.');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  };

  const handleOlvide = async () => {
    limpiarMensajes();
    if (!email.trim()) {
      setError('Ingresá tu email.');
      return;
    }
    setCargando(true);
    try {
      await resetPassword(email.trim());
      setMensaje('Te enviamos un email con instrucciones para restablecer tu contraseña.');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  };

  const submit = () => {
    if (modo === MODOS.LOGIN) return handleLogin();
    if (modo === MODOS.REGISTRO) return handleRegistro();
    return handleOlvide();
  };

  return (
    <div>
      <div className="segmented" style={{ marginBottom: 14 }}>
        <button
          className={`segmented__item ${modo === MODOS.LOGIN ? 'is-active' : ''}`}
          onClick={() => cambiarModo(MODOS.LOGIN)}
        >
          Iniciar sesión
        </button>
        <button
          className={`segmented__item ${modo === MODOS.REGISTRO ? 'is-active' : ''}`}
          onClick={() => cambiarModo(MODOS.REGISTRO)}
        >
          Crear cuenta
        </button>
      </div>

      <div className="field">
        <label>Email</label>
        <input
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </div>

      {modo !== MODOS.OLVIDE && (
        <div className="field">
          <label>Contraseña</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}

      {modo === MODOS.REGISTRO && (
        <div className="field">
          <label>Confirmar contraseña</label>
          <input
            type="password"
            placeholder="••••••••"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: -6, marginBottom: 10 }}>{error}</p>}
      {mensaje && (
        <p style={{ color: 'var(--ok)', fontSize: 12.5, marginTop: -6, marginBottom: 10 }}>{mensaje}</p>
      )}

      <button className="btn btn--primary" onClick={submit} disabled={cargando}>
        {cargando
          ? 'Un momento...'
          : modo === MODOS.LOGIN
          ? 'Iniciar sesión'
          : modo === MODOS.REGISTRO
          ? 'Crear cuenta'
          : 'Enviar instrucciones'}
      </button>

      <div style={{ marginTop: 10, textAlign: 'center' }}>
        {modo !== MODOS.OLVIDE ? (
          <button className="text-btn" onClick={() => cambiarModo(MODOS.OLVIDE)}>
            ¿Olvidaste tu contraseña?
          </button>
        ) : (
          <button className="text-btn" onClick={() => cambiarModo(MODOS.LOGIN)}>
            ← Volver a iniciar sesión
          </button>
        )}
      </div>
    </div>
  );
}
