-- ────────────────────────────────────────────────────────────────────────────
-- Ventas de ejemplo para ENSEÑAR el producto.
--
-- La demo se usa para vender: un bar que la abre y ve los informes en blanco no
-- se hace idea de lo que compra. Esto crea un día de servicio creíble —desayunos,
-- comidas y cenas, con dos camareros y una devolución— para que Informes y Caja
-- tengan algo que contar.
--
-- ⚠️ Es para la DEMO. En un bar de verdad no se lanza nunca: inventaría ventas
-- en su contabilidad. Se borra con `scripts/limpiar-ventas-ejemplo.sql`.
-- ────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_local uuid;
  v_mesa uuid;
  v_com uuid;
  v_num bigint;
  v_id uuid;
  v_prod record;
  v_hora int;
  v_cuantos int;
  v_camarero text;
  i int;
begin
  select id into v_local from locales where slug = 'marchando';
  perform set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('local_id', v_local))::text, true);

  -- Un servicio por franja: desayuno flojo, comida fuerte, cena media.
  foreach v_hora in array array[9, 10, 11, 13, 14, 15, 20, 21, 22] loop
    v_cuantos := case when v_hora in (14, 21) then 4 when v_hora in (13, 20, 22) then 3 else 2 end;

    for i in 1..v_cuantos loop
      v_camarero := case when (i % 2) = 0 then 'María' else 'Juan' end;

      insert into mesas (local_id, numero, capacidad, zona, estado, abierta_desde)
      values (v_local, 800 + i, 4, 'Ejemplo', 'ocupada', now())
      returning id into v_mesa;

      insert into comensales (local_id, mesa_id, nombre)
      values (v_local, v_mesa, 'Cliente') returning id into v_com;

      -- dos o tres productos de la carta de verdad, para que el ranking tenga
      -- nombres reconocibles
      for v_prod in
        select p.id, p.nombre,
               coalesce((p.precios ->> 'base')::numeric, (p.precios ->> 'pitufo')::numeric, 2.00) as precio
          from productos p
         where p.local_id = v_local
         order by md5(p.id::text || v_hora::text || i::text)
         limit 2 + (i % 2)
      loop
        insert into lineas_pedido (local_id, comensal_id, producto_id, nombre, precio, cantidad, tipo, estado)
        values (v_local, v_com, v_prod.id, v_prod.nombre, v_prod.precio, 1 + (i % 2), 'comida', 'enviado');
      end loop;

      v_num := cobrar_mesa(
        v_mesa,
        case when (i % 3) = 0 then '{"efectivo": 0}'::jsonb else '{"tarjeta": 0}'::jsonb end,
        case when (i % 4) = 0 then 1.00 else 0 end,
        v_camarero, 0);

      select id into v_id from tickets where numero = v_num and local_id = v_local;
      -- se coloca a su hora, en la zona del local
      update tickets
         set cerrado_en = (current_date + make_interval(hours => v_hora, mins => i * 7)) at time zone 'Europe/Madrid',
             camarero = v_camarero,
             pagos = jsonb_build_object(
               case when (i % 3) = 0 then 'efectivo' else 'tarjeta' end, total)
       where id = v_id;

      -- una devolución, para que se vea cómo se refleja
      if v_hora = 14 and i = 1 then
        perform emitir_rectificativa(v_id, 'Plato en mal estado', null, 'efectivo', 'María');
        update tickets set cerrado_en = (current_date + make_interval(hours => 15, mins => 10)) at time zone 'Europe/Madrid'
         where rectifica_a = v_id;
      end if;

      delete from mesas where id = v_mesa;
    end loop;
  end loop;
end $$;

select count(*) as tickets, round(sum(total), 2) as neto
  from tickets
 where local_id = (select id from locales where slug = 'marchando')
   and cerrado_en >= current_date;
