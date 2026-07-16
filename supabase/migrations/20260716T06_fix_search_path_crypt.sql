-- ============================================================================
-- TPV Hostelería · Migración 06: fix — crypt() fuera del search_path
--
-- En Supabase, pgcrypto se instala en el esquema `extensions`. verificar_pin
-- y fijar_pin fijan `search_path = public` (endurecimiento security definer),
-- lo que dejaba crypt()/gen_salt() irresolubles EN EJECUCIÓN → el PIN fallaba
-- para cualquier usuario. Detectado por la batería E2E del servidor.
-- ============================================================================
alter function verificar_pin(text, boolean) set search_path = public, extensions;
alter function fijar_pin(uuid, text)        set search_path = public, extensions;
