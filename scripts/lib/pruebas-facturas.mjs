// ────────────────────────────────────────────────────────────────────────────
// Facturas completas: lo que tiene que cumplir `emitir_factura`.
//
// Una factura completa sustituye al ticket (F3): NO es una venta nueva. Lo caro
// aquí es declarar dos veces lo mismo —dos facturas del mismo ticket, o una
// factura que cuenta en caja—, emitir con un NIF sin forma que la AEAT
// rechazará, o que el enlace del correo abra la factura de otro.
//
// Como el resto, cada prueba corre en una transacción que se deshace.
// ────────────────────────────────────────────────────────────────────────────

const montarMesa = (numero = 920) => `
  insert into mesas (local_id, numero, capacidad, zona, estado, abierta_desde)
  values (v_local, ${numero}, 4, 'Pruebas', 'ocupada', now()) returning id into v_mesa;
  select id into v_prod from productos where local_id = v_local and precios ? 'base' limit 1;
  insert into comensales (local_id, mesa_id, nombre) values (v_local, v_mesa, 'Uno') returning id into v_com;
`

const linea = (precio, nombre = 'Menu del dia') => `
  insert into lineas_pedido (local_id, comensal_id, producto_id, nombre, precio, cantidad, tipo, estado)
  values (v_local, v_com, v_prod, '${nombre}', ${precio}, 1, 'comida', 'enviado');
`

const cobrar = (importe) => `
  v_num := cobrar_mesa(v_mesa, jsonb_build_object('efectivo', ${importe}), 0, 'Prueba', 0);
  select id into v_id from tickets where numero = v_num and local_id = v_local;
`

// El local de pruebas con lo que exige una factura: CIF y domicilio.
const localFacturable = `
  update locales set config = coalesce(config, '{}'::jsonb)
    || '{"cif": "B12345674", "direccion": "C/ Prueba 1, Madrid", "razonSocial": "Pruebas S.L."}'::jsonb
   where id = v_local;
`

const emitir = (nif = 'B12345674', direccion = 'C/ Mayor 3, Madrid') =>
  `emitir_factura(v_id, 'Talleres Perez S.L.', '${nif}', '${direccion}', null, 'Prueba')`

const debeFallar = (llamada, codigo, queHacia) => `
  begin
    perform ${llamada};
    raise exception 'FALLO: ${queHacia}';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%${codigo}%' then raise; end if;
  end;
`

export const PRUEBAS_FACTURAS = [
  {
    nombre: 'factura: agrupa lineas, congela el desglose y NO crea otro ticket',
    cuerpo: ({ comprobar, comprobarIgual }) => `
${localFacturable}
${montarMesa()}
${linea('12.00')}
${linea('12.00')}
${cobrar('24.00')}
  select count(*) into v_dato from tickets where local_id = v_local;
  select * into v_fila from ${emitir('b-12.345.674')};
${comprobar('v_fila.numero is not null', 'la factura sale sin numero')}

  -- sustituye al ticket: si fuese una fila de tickets, la venta contaria dos veces
${comprobarIgual('(select count(*) from tickets where local_id = v_local)', 'v_dato', 'emitir una factura no puede crear un ticket')}

  select f.lineas into v_json from facturas f where f.id = v_fila.id;
${comprobarIgual('jsonb_array_length(v_json)', '1', 'dos menus iguales son UNA linea de factura')}
${comprobarIgual("(v_json -> 0 ->> 'cantidad')::numeric", '2', 'con cantidad 2')}

  select sum((d ->> 'base')::numeric + (d ->> 'cuota')::numeric) into v_dato
    from facturas f, jsonb_array_elements(f.desglose) d where f.id = v_fila.id;
${comprobarIgual('v_dato', '24.00', 'base mas cuota cuadra con el total')}

  select f.cliente_nif into v_txt from facturas f where f.id = v_fila.id;
${comprobarIgual('v_txt', "'B12345674'", 'el NIF se guarda limpio, sin puntos ni guiones')}
`,
  },

  {
    nombre: 'factura: el mismo ticket no se factura dos veces',
    cuerpo: () => `
${localFacturable}
${montarMesa()}
${linea('8.00')}
${cobrar('8.00')}
  perform ${emitir()};
${debeFallar(emitir(), 'ya_facturado', 'ha dejado emitir dos facturas del mismo ticket')}
`,
  },

  {
    nombre: 'factura: numeracion correlativa en su propia serie',
    cuerpo: ({ comprobarIgual }) => `
${localFacturable}
${montarMesa(921)}
${linea('5.00')}
${cobrar('5.00')}
  select * into v_fila from ${emitir()};
  v_dato := v_fila.numero;
${montarMesa(922)}
${linea('6.00')}
${cobrar('6.00')}
  select * into v_fila from ${emitir()};
${comprobarIgual('v_fila.numero', 'v_dato + 1', 'la segunda factura lleva el numero siguiente')}
${comprobarIgual('v_fila.serie', "'F'", 'la serie por defecto de facturas es F, no la de tickets')}
`,
  },

  {
    nombre: 'factura: un ticket con devolucion no se factura (la AEAT pide F1)',
    cuerpo: () => `
${localFacturable}
${montarMesa()}
${linea('10.00')}
${cobrar('10.00')}
  perform emitir_rectificativa(v_id, 'Prueba', 2.00, 'efectivo', 'Prueba');
${debeFallar(emitir(), 'ticket_con_devolucion', 'ha facturado como F3 un ticket con devolucion')}
`,
  },

  {
    nombre: 'factura: NIF sin forma, domicilio vacio y local sin CIF se rechazan',
    cuerpo: () => `
${localFacturable}
${montarMesa()}
${linea('4.00')}
${cobrar('4.00')}
${debeFallar(emitir('hola'), 'nif_invalido', 'ha aceptado un NIF sin forma')}
${debeFallar(emitir('B12345674', ' '), 'direccion_vacia', 'ha emitido sin domicilio del cliente')}
  update locales set config = config - 'cif' where id = v_local;
${debeFallar(emitir(), 'local_sin_cif', 'ha emitido sin CIF del local')}
`,
  },

  {
    nombre: 'factura: el enlace del correo abre SU factura y nada mas',
    cuerpo: ({ comprobar }) => `
${localFacturable}
${montarMesa()}
${linea('7.50')}
${cobrar('7.50')}
  select * into v_fila from ${emitir()};
  v_txt := v_fila.token;
${comprobar('length(v_txt) >= 32', 'el token es demasiado corto para no adivinarse')}
${comprobar("(factura_por_token(v_txt) ->> 'numero')::bigint = v_fila.numero", 'el token no abre su factura')}
${comprobar('factura_por_token(left(v_txt, 31)) is null', 'un token recortado abre la factura')}
${comprobar("factura_por_token(repeat('0', 64)) is null", 'un token inventado abre algo')}
`,
  },

  {
    nombre: 'factura: un ticket ya facturado no se devuelve con una R5',
    cuerpo: () => `
${localFacturable}
${montarMesa()}
${linea('9.00')}
${cobrar('9.00')}
  perform ${emitir()};
  -- la R5 corregiria el ticket, que ya esta sustituido por la F3
${debeFallar("emitir_rectificativa(v_id, 'Prueba', 2.00, 'efectivo', 'Prueba')", 'ticket_facturado', 'ha dejado devolver un ticket que ya tiene factura')}
`,
  },

  {
    nombre: 'clientes: guardar no duplica por NIF, pone al dia el domicilio y cuenta facturas',
    cuerpo: ({ comprobarIgual }) => `
${localFacturable}
  -- el recuento va en v_dato: v_num lo pisa cobrar() con el numero de ticket
  select count(*) into v_dato from clientes_factura where local_id = v_local;
${montarMesa(923)}
${linea('5.00')}
${cobrar('5.00')}
  perform emitir_factura(v_id, 'Construcciones Avila', 'A58818501', 'C/ Vieja 1', null, 'Prueba', true);
${montarMesa(924)}
${linea('6.00')}
${cobrar('6.00')}
  perform emitir_factura(v_id, 'Construcciones Avila S.A.', 'a-58.818.501', 'C/ Nueva 2', null, 'Prueba', true);
${comprobarIgual('(select count(*) from clientes_factura where local_id = v_local)', 'v_dato + 1', 'el mismo NIF es UN cliente')}
  select c.direccion, c.facturas into v_txt, v_dato from clientes_factura c where c.local_id = v_local and c.nif = 'A58818501';
${comprobarIgual('v_txt', "'C/ Nueva 2'", 'vale el domicilio de hoy')}
${comprobarIgual('v_dato >= 2', 'true', 'lleva la cuenta de sus facturas')}
`,
  },

  {
    nombre: 'clientes: sin marcar guardar, no se guarda nadie',
    cuerpo: ({ comprobarIgual }) => `
${localFacturable}
  select count(*) into v_dato from clientes_factura where local_id = v_local;
${montarMesa(925)}
${linea('5.00')}
${cobrar('5.00')}
  perform ${emitir('12345678Z')};
${comprobarIgual('(select count(*) from clientes_factura where local_id = v_local)', 'v_dato', 'ha guardado un cliente sin pedirlo')}
`,
  },

  {
    nombre: 'factura: no se puede facturar el ticket de otro bar',
    cuerpo: () => `
${localFacturable}
${montarMesa()}
${linea('4.00')}
${cobrar('4.00')}
  perform set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('local_id', gen_random_uuid()))::text, true);
${debeFallar(emitir(), 'local_sin_cif', 'ha dejado facturar desde otro local')}
`,
  },
]
