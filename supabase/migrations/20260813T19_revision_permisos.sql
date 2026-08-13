-- ────────────────────────────────────────────────────────────────────────────
-- 19. Poder MIRAR quién puede llamar a qué.
--
-- Los dos agujeros de la sesión anterior fueron el mismo fallo: Supabase tiene
-- `alter default privileges` que conceden EXECUTE a `anon` y `authenticated`
-- **en cuanto se crea una función**. `registrar_pago_online` llevaba en su
-- propia migración el comentario «no se concede a anon» y estaba concedida:
-- cualquiera con la carta abierta podía cerrar su cuenta sin pagar.
--
-- Leer el SQL no basta, porque el permiso no está escrito en ninguna parte:
-- lo pone la base sola. Hay que preguntárselo a ella.
--
-- Esta función devuelve la foto real. La usa `scripts/revisar-permisos.mjs`,
-- que la compara con la lista blanca versionada y falla si algo se ha abierto
-- sin querer. Va con la service_role key que ya vive en el PC del local, sin
-- necesidad de un token de la cuenta.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function revision_permisos()
returns table (funcion text, anon boolean, autenticado boolean)
language sql
security definer
set search_path = public
stable as $$
  select p.proname::text,
         has_function_privilege('anon',          p.oid, 'execute'),
         has_function_privilege('authenticated', p.oid, 'execute')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
   order by 1
$$;

-- Solo el servidor. Que la lista de qué puede llamar cada rol sea, ella misma,
-- consultable por cualquiera sería empezar la casa por el tejado.
revoke all on function revision_permisos() from public, anon, authenticated;
grant execute on function revision_permisos() to service_role;
