// ────────────────────────────────────────────────────────────────────────────
// Lo que tiene que cumplir el dinero. Cada prueba monta su propia mesa, hace lo
// suyo, y al terminar el envoltorio lo deshace todo: nada de esto llega a
// existir en la base.
//
// Variables ya declaradas por el envoltorio y disponibles en el cuerpo:
//   v_local v_mesa v_com v_com2 v_com3 v_prod v_num v_dato v_json v_fila
// ────────────────────────────────────────────────────────────────────────────

// Mesa de pruebas con N comensales. Números 900+ para no pisar la sala real.
const montarMesa = (comensales = 1, numero = 900) => `
  insert into mesas (local_id, numero, capacidad, zona, estado, abierta_desde)
  values (v_local, ${numero}, 6, 'Pruebas', 'ocupada', now()) returning id into v_mesa;
  select id into v_prod from productos where local_id = v_local and precios ? 'base' limit 1;
  insert into comensales (local_id, mesa_id, nombre) values (v_local, v_mesa, 'Uno') returning id into v_com;
${comensales > 1 ? `  insert into comensales (local_id, mesa_id, nombre) values (v_local, v_mesa, 'Dos') returning id into v_com2;` : ''}
${comensales > 2 ? `  insert into comensales (local_id, mesa_id, nombre) values (v_local, v_mesa, 'Tres') returning id into v_com3;` : ''}
`

// Línea con el precio puesto a mano: así el importe de la prueba no depende de
// lo que cueste hoy el bocadillo de la carta.
const linea = (comensal, precio, compartidoCon = null) => `
  insert into lineas_pedido (local_id, comensal_id, producto_id, nombre, precio, cantidad, tipo, estado${compartidoCon ? ', compartido_con' : ''})
  values (v_local, ${comensal}, v_prod, 'Prueba', ${precio}, 1, 'comida', 'enviado'${compartidoCon ? `, ${compartidoCon}` : ''});
`

export const PRUEBAS = [
  {
    nombre: 'pendiente_de_pago suma lo que consumió la mesa',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa(2)}
${linea('v_com', '10.00')}
${linea('v_com2', '5.50')}
  v_dato := pendiente_de_pago(v_mesa, null);
${comprobarIgual('v_dato', '15.50', 'el pendiente de la mesa')}
  v_dato := pendiente_de_pago(v_mesa, v_com);
${comprobarIgual('v_dato', '10.00', 'el pendiente de un solo comensal')}
`,
  },

  {
    nombre: 'un plato compartido a tres reparte los céntimos y CUADRA',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa(3)}
${linea('v_com', '20.00', 'array[v_com2, v_com3]')}
  select sum(importe) into v_dato from _debe_por_comensal(array[v_mesa]);
${comprobarIgual('v_dato', '20.00', 'el reparto suma el total sin perder ni inventar céntimos')}
  select count(*) into v_dato from _debe_por_comensal(array[v_mesa]) where importe = 0;
${comprobarIgual('v_dato', '0', 'nadie se queda a cero en un plato que comparte')}
`,
  },

  {
    nombre: 'quitar a alguien de un plato compartido recalcula el reparto',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa(3)}
${linea('v_com', '20.00', 'array[v_com2, v_com3]')}
  update lineas_pedido set compartido_con = array[v_com2] where comensal_id = v_com;
  select sum(importe) into v_dato from _debe_por_comensal(array[v_mesa]);
${comprobarIgual('v_dato', '20.00', 'sigue cuadrando después de quitar a uno')}
  select coalesce(sum(importe), 0) into v_dato from _debe_por_comensal(array[v_mesa]) where comensal_id = v_com3;
${comprobarIgual('v_dato', '0', 'quien ya no comparte no debe nada')}
`,
  },

  {
    nombre: 'cobrar_mesa emite ticket por el total y deja la mesa libre',
    cuerpo: ({ comprobar, comprobarIgual }) => `
${montarMesa(2)}
${linea('v_com', '7.30')}
${linea('v_com2', '2.70')}
  v_num := cobrar_mesa(v_mesa, '{"efectivo": 10.00}'::jsonb, 0, 'Prueba', 0);
  select total into v_dato from tickets where numero = v_num and local_id = v_local;
${comprobarIgual('v_dato', '10.00', 'el total del ticket')}
  select * into v_fila from mesas where id = v_mesa;
${comprobar(`v_fila.estado = 'libre'`, 'la mesa queda libre tras cobrar')}
  select count(*) into v_dato from comensales where mesa_id = v_mesa;
${comprobarIgual('v_dato', '0', 'el servicio se limpia al cobrar')}
`,
  },

  {
    nombre: 'la numeración de tickets es correlativa y sin huecos',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa(1, 900)}
${linea('v_com', '1.00')}
  v_num := cobrar_mesa(v_mesa, '{"efectivo": 1.00}'::jsonb, 0, 'Prueba', 0);
${montarMesa(1, 901)}
${linea('v_com', '2.00')}
  v_dato := cobrar_mesa(v_mesa, '{"efectivo": 2.00}'::jsonb, 0, 'Prueba', 0);
${comprobarIgual('v_dato', 'v_num + 1', 'el segundo ticket va justo detrás del primero')}
`,
  },

  {
    nombre: 'un descuento mayor que la cuenta no deja el total en negativo',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa(1)}
${linea('v_com', '5.00')}
  v_num := cobrar_mesa(v_mesa, '{}'::jsonb, 0, 'Prueba', 999);
  select total into v_dato from tickets where numero = v_num and local_id = v_local;
${comprobarIgual('v_dato', '0.00', 'el total se queda en 0, no en negativo')}
`,
  },

  {
    nombre: 'pagar_parte cierra la mesa cuando paga el último',
    cuerpo: ({ comprobar }) => `
${montarMesa(2)}
${linea('v_com', '4.00')}
${linea('v_com2', '6.00')}
  select * into v_fila from pagar_parte(v_com, 0, 'tarjeta', 'Prueba');
${comprobar('v_fila.cerrada = false', 'con uno pagando de dos, la mesa sigue abierta')}
  select * into v_fila from pagar_parte(v_com2, 0, 'tarjeta', 'Prueba');
${comprobar('v_fila.cerrada = true', 'al pagar el último se cierra la mesa')}
${comprobar('v_fila.ticket is not null', 'y sale su ticket')}
`,
  },

  {
    nombre: 'registrar_pago_online NO cobra dos veces el mismo pago de Stripe',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa(1)}
${linea('v_com', '9.00')}
  v_json := registrar_pago_online(v_mesa, v_com, 9.00, 0, 'cs_prueba_idem', v_local);
  v_json := registrar_pago_online(v_mesa, v_com, 9.00, 0, 'cs_prueba_idem', v_local);
  select count(*) into v_dato from pagos_online where referencia = 'cs_prueba_idem';
${comprobarIgual('v_dato', '1', 'un reintento de Stripe no puede duplicar el cobro')}
`,
  },

  {
    nombre: 'un pago que llega con la cuenta ya saldada se guarda sin ticket',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa(1)}
${linea('v_com', '3.00')}
  v_json := registrar_pago_online(v_mesa, v_com, 3.00, 0, 'cs_prueba_primero', v_local);
  v_json := registrar_pago_online(v_mesa, null, 3.00, 0, 'cs_prueba_tarde', v_local);
  select count(*) into v_dato from pagos_online where referencia = 'cs_prueba_tarde' and ticket is null;
${comprobarIgual('v_dato', '1', 'el dinero de más se registra aunque no cuadre con ninguna cuenta')}
`,
  },

  {
    nombre: 'el precio lo pone el servidor, no el navegador',
    cuerpo: ({ comprobar }) => `
${montarMesa(1)}
  perform qr_agregar_linea(v_com, v_prod, null, '{}'::jsonb, 1, 1);
  select l.precio as precio, p.precios as precios into v_fila
    from lineas_pedido l join productos p on p.id = l.producto_id
   where l.comensal_id = v_com limit 1;
${comprobar(`v_fila.precio = (v_fila.precios->>'base')::numeric`, 'el precio de la línea sale de la carta')}
`,
  },

  {
    nombre: 'pedir acceso tiene tope: no se puede llenar la lista del encargado',
    cuerpo: ({ comprobar, comprobarIgual }) => `
  -- Se parte de cero: la prueba no puede depender de si alguien tenía una
  -- solicitud viva. Esto también se deshace al terminar.
  delete from dispositivos where local_id = v_local and estado = 'pendiente';

  -- cinco seguidas pasan (montar un bar son varios aparatos)
  for i in 1..5 loop
    perform solicitar_dispositivo('marchando', 'prueba');
  end loop;
  select count(*) into v_dato from dispositivos where local_id = v_local and estado = 'pendiente';
${comprobarIgual('v_dato', '5', 'las cinco primeras entran')}

  -- la sexta en el mismo minuto, no
  begin
    perform solicitar_dispositivo('marchando', 'prueba');
    raise exception 'FALLO: la sexta solicitud seguida deberia haberse rechazado';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%demasiadas_solicitudes%' then raise; end if;
  end;
`,
  },

  {
    nombre: 'la cola idempotente no suma una unidad de más al reenviar',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa(1)}
  perform qr_agregar_linea_idem('clave-de-prueba', v_com, v_prod, null, '{}'::jsonb, 1, 1);
  perform qr_agregar_linea_idem('clave-de-prueba', v_com, v_prod, null, '{}'::jsonb, 1, 1);
  perform qr_agregar_linea_idem('clave-de-prueba', v_com, v_prod, null, '{}'::jsonb, 1, 1);
  select coalesce(sum(cantidad), 0) into v_dato from lineas_pedido where comensal_id = v_com;
${comprobarIgual('v_dato', '1', 'tres reenvíos de la misma operación son una sola unidad')}
`,
  },
]
