-- ────────────────────────────────────────────────────────────────────────────
-- 25. Autorizar y revocar dispositivos se comprueba con el PIN de admin.
--
-- La 22 exigía ser admin mirando `empleados.user_id = auth.uid()`. Eso valía
-- cuando la sesión era de una PERSONA (el correo y la contraseña del local).
-- Con dispositivos autorizados, la cuenta es DEL APARATO: no está ligada a
-- ningún empleado, así que `_soy_admin()` era falso para todos y nadie podía
-- autorizar nada desde el panel. Lo vi al pulsar el botón: no pasaba nada.
--
-- Con el modelo nuevo, quien identifica a la PERSONA es el PIN — es lo que
-- distingue a un camarero de un encargado. Así que eso es lo que hay que
-- comprobar, y comprobarlo EN EL SERVIDOR: que la pantalla pida el PIN no
-- sirve de nada si la RPC se puede llamar por su cuenta.
--
-- Efecto secundario deseable: dar acceso a un aparato nuevo vuelve a pedir el
-- PIN de encargado aunque ya estés dentro del panel. Es una acción rara y
-- delicada; que cueste un gesto más está bien.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function aprobar_dispositivo(p_id uuid, p_nombre text default null, p_pin text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from verificar_pin(coalesce(p_pin, ''), true)) then
    raise exception 'pin_no_admin';
  end if;
  update dispositivos
     set estado = 'aprobado',
         aprobado_en = now(),
         nombre = coalesce(nullif(btrim(p_nombre), ''), nombre)
   where id = p_id and local_id = local_actual() and estado = 'pendiente';
  if not found then raise exception 'dispositivo_no_existe'; end if;
end $$;

create or replace function revocar_dispositivo(p_id uuid, p_pin text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not exists (select 1 from verificar_pin(coalesce(p_pin, ''), true)) then
    raise exception 'pin_no_admin';
  end if;
  update dispositivos set estado = 'revocado'
   where id = p_id and local_id = local_actual()
   returning user_id into v_user;
  if not found then raise exception 'dispositivo_no_existe'; end if;
  return v_user;
end $$;

-- Las versiones viejas (sin PIN) se van: dejarlas sería dejar la puerta que
-- acabamos de cerrar.
drop function if exists aprobar_dispositivo(uuid, text);
drop function if exists revocar_dispositivo(uuid);

grant execute on function aprobar_dispositivo(uuid, text, text) to authenticated;
grant execute on function revocar_dispositivo(uuid, text)       to authenticated;
revoke all on function aprobar_dispositivo(uuid, text, text) from public, anon;
revoke all on function revocar_dispositivo(uuid, text)       from public, anon;
