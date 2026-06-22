import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, supabaseConfigurado } from '../lib/supabaseClient';
import { resolverHogar } from '../lib/cloudRepo';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [householdId, setHouseholdId] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [cargandoHogar, setCargandoHogar] = useState(false);
  const [errorHogar, setErrorHogar] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  // --- Conectividad (heurística simple basada en navigator.onLine) ---
  useEffect(() => {
    const marcarOnline = () => setIsOnline(true);
    const marcarOffline = () => setIsOnline(false);
    window.addEventListener('online', marcarOnline);
    window.addEventListener('offline', marcarOffline);
    return () => {
      window.removeEventListener('online', marcarOnline);
      window.removeEventListener('offline', marcarOffline);
    };
  }, []);

  // --- Sesión ---
  useEffect(() => {
    if (!supabaseConfigurado) {
      setCargandoSesion(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setCargandoSesion(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
      if (!nuevaSesion) setHouseholdId(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // --- Hogar (una vez que hay sesión) ---
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    let cancelado = false;
    setCargandoHogar(true);
    setErrorHogar('');
    resolverHogar(userId)
      .then((id) => {
        if (!cancelado) setHouseholdId(id);
      })
      .catch((err) => {
        if (!cancelado) setErrorHogar(err.message || 'No se pudo cargar tu hogar.');
      })
      .finally(() => {
        if (!cancelado) setCargandoHogar(false);
      });
    return () => {
      cancelado = true;
    };
  }, [session?.user?.id]);

  const signUp = useCallback(async (email, password) => {
    if (!supabaseConfigurado) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabaseConfigurado) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseConfigurado) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!supabaseConfigurado) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
    });
    if (error) throw error;
  }, []);

  const value = {
    supabaseConfigurado,
    session,
    user: session?.user || null,
    householdId,
    cargandoSesion,
    cargandoHogar,
    errorHogar,
    isOnline,
    // "modo nube" activo: hay sesión Y se pudo resolver el hogar.
    modoNube: Boolean(session && householdId),
    signUp,
    signIn,
    signOut,
    resetPassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() tiene que usarse dentro de <AuthProvider>.');
  return ctx;
}
