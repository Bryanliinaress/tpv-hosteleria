// ────────────────────────────────────────────────────────────────────────────
// Borradores: una mesa cerrada sin cobrar NO desaparece.
//
// Lo que se prueba es lo que la ley antifraude exige y lo que un encargado
// necesita: que la cuenta quede guardada con su motivo, que no se pueda cerrar
// con consumo sin decir por qué, que un grupo de mesas se cierre entero, que
// otro bar no pueda tocarla y que, una vez guardada, no se pueda borrar.
//
// Como el resto, cada prueba corre en una transacción que se deshace.
// ────────────────────────────────────────────────────────────────────────────

const montarMesa = (numero = 940) => `
  insert into mesas (local_id, numero, capacidad, zona, estado, abierta_desde)
  values (v_local, ${numero}, 4, 'Pruebas', 'ocupada', now()) returning id into v_mesa;
  select id into v_prod from productos where local_id = v_local and precios ? 'base' limit 1;
  insert into comensales (local_id, mesa_id, nombre) values (v_local, v_mesa, 'Uno') returning id into v_com;
`

const linea = (precio, comensal = 'v_com') => `
  insert into lineas_pedido (local_id, comensal_id, producto_id, nombre, precio, cantidad, tipo, estado)
  values (v_local, ${comensal}, v_prod, 'Prueba', ${precio}, 1, 'comida', 'enviado');
`

const debeFallar = (llamada, codigo, queHacia) => `
  begin
    perform ${llamada};
    raise exception 'FALLO: ${queHacia}';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%${codigo}%' then raise; end if;
  end;
`

export const PRUEBAS_BORRADORES = [
  {
    nombre: 'cerrar sin cobrar: con consumo exige motivo',
    cuerpo: () => `
${montarMesa()}
${linea('12.00')}
${debeFallar("cerrar_mesa_sin_cobrar(v_mesa, '   ', 'Prueba')", 'motivo_cierre_obligatorio', 'ha cerrado sin cobrar una mesa con consumo y sin motivo')}
`,
  },

  {
    nombre: 'cerrar sin cobrar: la cuenta queda guardada y la mesa libre',
    cuerpo: ({ comprobar, comprobarIgual }) => `
${montarMesa(941)}
${linea('12.00')}
${linea('3.00')}
  v_id := cerrar_mesa_sin_cobrar(v_mesa, 'Se fue sin pagar', 'Encargado');
${comprobar('v_id is not null', 'no ha guardado la cuenta anulada')}
  select c.total, c.detalle into v_dato, v_json from cuentas_anuladas c where c.id = v_id;
${comprobarIgual('v_dato', '15.00', 'guarda el importe entero')}
${comprobarIgual("(select c.sin_cobrar from cuentas_anuladas c where c.id = v_id)", '15.00', 'y lo que quedaba sin cobrar')}
${comprobarIgual("(select c.motivo from cuentas_anuladas c where c.id = v_id)", "'Se fue sin pagar'", 'con su motivo')}
${comprobarIgual("jsonb_array_length(v_json -> 0 -> 'items')", '2', 'y lo que se pidio, linea a linea')}
${comprobarIgual("(select m.estado from mesas m where m.id = v_mesa)", "'libre'", 'la mesa queda libre')}
${comprobarIgual('(select count(*) from comensales c where c.mesa_id = v_mesa)', '0', 'sin comensales')}
`,
  },

  {
    nombre: 'cerrar sin cobrar: una mesa sin nada pedido se libera sin motivo ni borrador',
    cuerpo: ({ comprobar, comprobarIgual }) => `
  select count(*) into v_dato from cuentas_anuladas;
${montarMesa(942)}
  v_id := cerrar_mesa_sin_cobrar(v_mesa, null, 'Prueba');
${comprobar('v_id is null', 'ha guardado un borrador de una mesa vacia')}
${comprobarIgual('(select count(*) from cuentas_anuladas)', 'v_dato', 'no hay borrador nuevo')}
${comprobarIgual("(select m.estado from mesas m where m.id = v_mesa)", "'libre'", 'y la mesa queda libre')}
`,
  },

  {
    nombre: 'cerrar sin cobrar: un grupo de mesas se cierra entero en una cuenta',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa(943)}
${linea('10.00')}
  insert into mesas (local_id, numero, capacidad, zona, estado, abierta_desde, unida_a)
  values (v_local, 944, 4, 'Pruebas', 'ocupada', now(), v_mesa) returning id into v_id;
  insert into comensales (local_id, mesa_id, nombre) values (v_local, v_id, 'Dos') returning id into v_com2;
${linea('5.00', 'v_com2')}
  -- se cierra desde la SECUNDARIA: tiene que llevarse el grupo entero
  v_txt := cerrar_mesa_sin_cobrar(v_id, 'Abierta por error', 'Prueba')::text;
${comprobarIgual("(select c.total from cuentas_anuladas c where c.id = v_txt::uuid)", '15.00', 'la cuenta junta las dos mesas')}
${comprobarIgual("(select jsonb_array_length(c.detalle) from cuentas_anuladas c where c.id = v_txt::uuid)", '2', 'con los comensales de las dos')}
${comprobarIgual("(select count(*) from mesas m where m.id in (v_mesa, v_id) and m.estado = 'libre' and m.unida_a is null)", '2', 'y las dos quedan libres y separadas')}
`,
  },

  {
    nombre: 'cerrar sin cobrar: la mesa de otro bar no se toca',
    cuerpo: () => `
${montarMesa(945)}
${linea('4.00')}
  perform set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('local_id', gen_random_uuid()))::text, true);
${debeFallar("cerrar_mesa_sin_cobrar(v_mesa, 'Intento', 'x')", 'mesa_no_existe', 'ha dejado cerrar la mesa de otro local')}
`,
  },

  {
    nombre: 'cuenta anulada: el personal no la puede cambiar ni borrar',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa(946)}
${linea('8.00')}
  v_id := cerrar_mesa_sin_cobrar(v_mesa, 'Invitacion de la casa', 'Prueba');
  -- con el rol de un aparato del bar, como llegaria desde la API
  execute 'set local role authenticated';
  update cuentas_anuladas set motivo = 'otra cosa', sin_cobrar = 0 where id = v_id;
  delete from cuentas_anuladas where id = v_id;
  execute 'reset role';
${comprobarIgual('(select count(*) from cuentas_anuladas c where c.id = v_id)', '1', 'se ha podido BORRAR una cuenta anulada')}
${comprobarIgual("(select c.motivo from cuentas_anuladas c where c.id = v_id)", "'Invitacion de la casa'", 'se ha podido CAMBIAR una cuenta anulada')}
`,
  },
]
