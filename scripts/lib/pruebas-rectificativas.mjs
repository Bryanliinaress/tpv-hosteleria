// ────────────────────────────────────────────────────────────────────────────
// Devoluciones: lo que tiene que cumplir una factura rectificativa.
//
// Un ticket ya registrado en la AEAT no se borra ni se edita. Si el bar cobró
// de más, se emite una rectificativa. Aquí sale dinero del cajón, así que es
// donde más caro sale equivocarse: devolver dos veces lo mismo, que el reparto
// entre tipos de IVA no cuadre, o que el arqueo no lo recoja.
//
// Como el resto, cada prueba corre en una transacción que se deshace: nada de
// esto llega a existir.
// ────────────────────────────────────────────────────────────────────────────

const montarMesa = (numero = 910) => `
  insert into mesas (local_id, numero, capacidad, zona, estado, abierta_desde)
  values (v_local, ${numero}, 4, 'Pruebas', 'ocupada', now()) returning id into v_mesa;
  select id into v_prod from productos where local_id = v_local and precios ? 'base' limit 1;
  insert into comensales (local_id, mesa_id, nombre) values (v_local, v_mesa, 'Uno') returning id into v_com;
`

const linea = (precio, ivaPct = null) => `
  insert into lineas_pedido (local_id, comensal_id, producto_id, nombre, precio, cantidad, tipo, estado${ivaPct ? ', iva_pct' : ''})
  values (v_local, v_com, v_prod, 'Prueba', ${precio}, 1, 'comida', 'enviado'${ivaPct ? `, ${ivaPct}` : ''});
`

// Cobra la mesa montada y deja el id del ticket en v_id.
const cobrar = (importe) => `
  v_num := cobrar_mesa(v_mesa, jsonb_build_object('efectivo', ${importe}), 0, 'Prueba', 0);
  select id into v_id from tickets where numero = v_num and local_id = v_local;
`

// Comprueba que una llamada falla con el error esperado.
const debeFallar = (llamada, codigo, queHacia) => `
  begin
    perform ${llamada};
    raise exception 'FALLO: ${queHacia}';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%${codigo}%' then raise; end if;
  end;
`

export const PRUEBAS_RECTIFICATIVAS = [
  {
    nombre: 'una devolución completa no se puede repetir',
    cuerpo: ({ comprobar, comprobarIgual }) => `
${montarMesa()}
${linea('12.00')}
${cobrar('12.00')}
  select * into v_fila from emitir_rectificativa(v_id, 'Cobrado de mas', null, 'efectivo', 'Encargado');
${comprobarIgual('v_fila.total', '-12.00', 'la rectificativa es el negativo del ticket')}
${comprobar('v_fila.numero = v_num + 1', 'se numera con el mismo contador, sin huecos en la serie')}
${debeFallar("emitir_rectificativa(v_id, 'Otra vez', null, 'efectivo', 'Encargado')", 'importe_invalido', 'ha dejado devolver dos veces el mismo ticket')}
`,
  },

  {
    nombre: 'una devolución parcial deja devolver el resto, pero ni un céntimo más',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa()}
${linea('10.00')}
${cobrar('10.00')}
  perform emitir_rectificativa(v_id, 'Una cana de mas', 3.00, 'efectivo', 'Encargado');
${comprobarIgual('_pendiente_de_rectificar(v_id)', '7.00', 'queda por devolver el resto')}
${debeFallar("emitir_rectificativa(v_id, 'Pasarse', 7.01, 'efectivo', 'Encargado')", 'supera_lo_pendiente', 'ha dejado devolver mas de lo cobrado')}
  perform emitir_rectificativa(v_id, 'El resto', 7.00, 'efectivo', 'Encargado');
${comprobarIgual('_pendiente_de_rectificar(v_id)', '0', 'ya no queda nada por devolver')}
`,
  },

  {
    nombre: 'una devolución parcial reparte entre los tipos de IVA y cuadra al céntimo',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa()}
${linea('11.00', '10')}
${linea('12.10', '21')}
${cobrar('23.10')}
  -- 10 € de 23,10 €: un reparto que no da exacto en ninguno de los dos tipos
  select * into v_fila from emitir_rectificativa(v_id, 'Devolucion parcial', 10.00, 'tarjeta', 'Encargado');

  select sum((i ->> 'precio')::numeric) into v_dato
    from tickets t
    cross join lateral jsonb_array_elements(t.detalle) c
    cross join lateral jsonb_array_elements(c -> 'items') i
   where t.id = v_fila.id;
${comprobarIgual('v_dato', '-10.00', 'las partes por tipo suman exactamente lo devuelto')}

  select sum(base + cuota) into v_dato from desglose_iva_ticket(v_fila.id);
${comprobarIgual('v_dato', '-10.00', 'el desglose de la rectificativa tambien cuadra')}

  select count(*) into v_dato from desglose_iva_ticket(v_fila.id);
${comprobarIgual('v_dato', '2', 'se rectifican los DOS tipos, no solo uno')}
`,
  },

  {
    nombre: 'la rectificativa resta en la caja sin tocar el ticket original',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa()}
${linea('20.00')}
${cobrar('20.00')}
  perform emitir_rectificativa(v_id, 'Devolucion', 5.00, 'efectivo', 'Encargado');

  select total into v_dato from tickets where id = v_id;
${comprobarIgual('v_dato', '20.00', 'el original NO se toca: es un documento ya emitido')}

  select sum(total) into v_dato from tickets where id = v_id or rectifica_a = v_id;
${comprobarIgual('v_dato', '15.00', 'lo que queda es la diferencia')}

  select sum((pagos ->> 'efectivo')::numeric) into v_dato from tickets where id = v_id or rectifica_a = v_id;
${comprobarIgual('v_dato', '15.00', 'y el desglose por metodo, para que el arqueo cuadre')}
`,
  },

  {
    nombre: 'ni sin motivo, ni rectificar una rectificativa',
    cuerpo: () => `
${montarMesa()}
${linea('5.00')}
${cobrar('5.00')}
${debeFallar("emitir_rectificativa(v_id, '   ', null, 'efectivo', 'Encargado')", 'motivo_obligatorio', 'ha dejado devolver sin motivo')}
  select * into v_fila from emitir_rectificativa(v_id, 'Motivo de verdad', null, 'efectivo', 'Encargado');
${debeFallar("emitir_rectificativa(v_fila.id, 'Otra vuelta', null, 'efectivo', 'Encargado')", 'ya_es_rectificativa', 'ha dejado rectificar una rectificativa')}
`,
  },

  {
    nombre: 'lo que se manda a Hacienda identifica al ticket corregido',
    cuerpo: ({ comprobar, comprobarIgual }) => `
${montarMesa()}
${linea('8.00')}
${cobrar('8.00')}
  select * into v_fila from emitir_rectificativa(v_id, 'Cobrado de mas', null, 'efectivo', 'Encargado');

  v_json := ticket_para_fiscal(v_fila.id);
${comprobar("v_json -> 'rectifica' is not null and v_json -> 'rectifica' <> 'null'::jsonb", 'la rectificativa dice a que factura corrige')}
${comprobarIgual("(v_json #>> '{rectifica,numero}')::bigint", 'v_num', 'con el numero del original')}
${comprobarIgual("(v_json ->> 'total')::numeric", '-8.00', 'y el importe en negativo, que es rectificar por diferencias')}

  -- un ticket normal NO lleva ese bloque: se sigue mandando como F2
  v_json := ticket_para_fiscal(v_id);
${comprobar("coalesce(v_json -> 'rectifica', 'null'::jsonb) = 'null'::jsonb", 'un ticket normal se sigue mandando como factura simplificada')}
`,
  },

  {
    nombre: 'devolver la cuenta de otro bar no es posible',
    cuerpo: () => `
${montarMesa()}
${linea('4.00')}
${cobrar('4.00')}
  -- la sesion pasa a ser de OTRO local: el ticket deja de existir para el
  perform set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('local_id', gen_random_uuid()))::text, true);
${debeFallar("emitir_rectificativa(v_id, 'Intento', null, 'efectivo', 'Fulano')", 'ticket_no_existe', 'ha dejado devolver el ticket de otro local')}
`,
  },
]
