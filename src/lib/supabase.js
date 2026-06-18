import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Si no hay credenciales, la app funciona en modo local (solo localStorage).
export const supabase = (url && anonKey) ? createClient(url, anonKey) : null
export const supabaseActivo = !!supabase
