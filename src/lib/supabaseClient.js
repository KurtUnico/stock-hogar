import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si no hay variables de entorno configuradas, la app sigue funcionando
// 100% en modo local (igual que antes de esta evolución) — simplemente no
// se ofrece la opción de iniciar sesión. Esto evita que la app se rompa en
// previews/forks donde todavía no se configuró Supabase.
export const supabaseConfigurado = Boolean(url && anonKey);

export const supabase = supabaseConfigurado
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

if (!supabaseConfigurado && typeof window !== 'undefined') {
  console.info(
    'Stock Hogar: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no están configuradas. ' +
      'La app funciona en modo local (sin cuenta). Ver .env.example.'
  );
}
