// ────────────────────────────────────────────────────────────────────────────
// Informes de ventas.
//
// Lo que se comprueba aquí no es «que salgan números»: es que las devoluciones
// RESTEN del facturado y no aparezcan como si fueran ventas. Una rectificativa
// es un ticket con líneas sintéticas («Devolución (IVA 10%)»), así que sin
// cuidado sale en el ranking de productos como si fuera un plato, suma un
// comensal que nunca existió y cuenta como un ticket más hundiendo el medio.
//
// Y la hora, en la zona del local: agrupar por hora en UTC da un informe de
// horas punta desplazado dos horas en verano, y con eso se contrata personal
// para la hora equivocada.
//
// Cada prueba se AÍSLA en una ventana de fechas propia, moviendo ahí los
// tickets que ella misma crea. Si en vez de eso midiera «lo de ahora», el
// resultado dependería de lo que ya hubiera en la base del bar —y una prueba
// que pasa o falla según el día no vale para nada.
// ────────────────────────────────────────────────────────────────────────────

const DESDE = "timestamptz '2001-03-01 00:00:00+01'"
const HASTA = "timestamptz '2001-03-02 00:00:00+01'"
const HORA = "timestamptz '2001-03-01 13:20:00+01'"
const PERIODO = `${DESDE}, ${HASTA}`

// Mueve a la ventana de la prueba los tickets recién creados por ella.
const aislar = (cuando = HORA) => `
  update tickets set cerrado_en = ${cuando}
   where local_id = v_local and cerrado_en > now() - interval '5 minutes';
`

const montarMesa = (numero = 920) => `
  insert into mesas (local_id, numero, capacidad, zona, estado, abierta_desde)
  values (v_local, ${numero}, 4, 'Pruebas', 'ocupada', now()) returning id into v_mesa;
  select id into v_prod from productos where local_id = v_local and precios ? 'base' limit 1;
  insert into comensales (local_id, mesa_id, nombre) values (v_local, v_mesa, 'Uno') returning id into v_com;
`

const linea = (nombre, precio, cantidad = 1) => `
  insert into lineas_pedido (local_id, comensal_id, producto_id, nombre, precio, cantidad, tipo, estado, iva_pct)
  values (v_local, v_com, v_prod, '${nombre}', ${precio}, ${cantidad}, 'comida', 'enviado', 10);
`

const cobrar = (importe, quien = 'Ana') => `
  v_num := cobrar_mesa(v_mesa, jsonb_build_object('efectivo', ${importe}), 0, '${quien}', 0);
  select id into v_id from tickets where numero = v_num and local_id = v_local;
`

export const PRUEBAS_INFORMES = [
  {
    nombre: 'una devolución resta del facturado y no cuenta como venta',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa()}
${linea('Cana', '2.00', 5)}
${cobrar('10.00')}
  perform emitir_rectificativa(v_id, 'Cobrado de mas', 4.00, 'efectivo', 'Ana');
${aislar()}
  v_json := informe_ventas(${PERIODO});
${comprobarIgual("(v_json #>> '{resumen,tickets}')::int", '1', 'una venta, no dos: la devolucion no es una venta')}
${comprobarIgual("(v_json #>> '{resumen,bruto}')::numeric", '10.00', 'el bruto son las ventas, sin descontar')}
${comprobarIgual("(v_json #>> '{resumen,devuelto}')::numeric", '4.00', 'lo devuelto va aparte y en positivo')}
${comprobarIgual("(v_json #>> '{resumen,neto}')::numeric", '6.00', 'el neto es lo que se queda el bar')}
${comprobarIgual("(v_json #>> '{resumen,medio}')::numeric", '10.00', 'el ticket medio sale de las ventas, no de las devoluciones')}
`,
  },

  {
    nombre: 'la devolución NO aparece en el ranking de productos',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa()}
${linea('Tortilla', '9.00')}
${cobrar('9.00')}
  perform emitir_rectificativa(v_id, 'Estaba fria', null, 'efectivo', 'Ana');
${aislar()}
  v_json := informe_ventas(${PERIODO});
  select count(*) into v_dato
    from jsonb_array_elements(v_json -> 'por_producto') p
   where p ->> 'nombre' like 'Devoluci%';
${comprobarIgual('v_dato', '0', 'una devolucion no es un producto del ranking')}
  select count(*) into v_dato from jsonb_array_elements(v_json -> 'por_producto');
${comprobarIgual('v_dato', '1', 'solo esta la tortilla que se vendio de verdad')}
`,
  },

  {
    nombre: 'la devolución no inventa un comensal',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa()}
${linea('Menu', '12.00')}
${cobrar('12.00')}
  perform emitir_rectificativa(v_id, 'Devuelto entero', null, 'efectivo', 'Ana');
${aislar()}
  v_json := informe_ventas(${PERIODO});
${comprobarIgual("(v_json #>> '{resumen,comensales}')::int", '1', 'solo el comensal de verdad')}
${comprobarIgual("(v_json #>> '{resumen,devoluciones}')::int", '1', 'las devoluciones se cuentan aparte')}
${comprobarIgual("(v_json #>> '{resumen,neto}')::numeric", '0', 'devuelto entero: el bar no se queda nada')}
`,
  },

  {
    nombre: 'quien atiende y quien cobra se cuentan por separado',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa()}
${linea('Cafe', '1.50')}
${cobrar('1.50', 'Berto')}
  update tickets set camarero = 'Ana' where id = v_id;
${aislar()}
  v_json := informe_ventas(${PERIODO});
  select count(*) into v_dato from jsonb_array_elements(v_json -> 'por_camarero') c where c ->> 'nombre' = 'Ana';
${comprobarIgual('v_dato', '1', 'Ana aparece como quien atendio')}
  select count(*) into v_dato from jsonb_array_elements(v_json -> 'por_cobrador') c where c ->> 'nombre' = 'Berto';
${comprobarIgual('v_dato', '1', 'Berto aparece como quien cobro')}
`,
  },

  {
    nombre: 'la hora se agrupa en la zona del local, no en UTC',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa()}
${linea('Copa', '6.00')}
${cobrar('6.00')}
  -- Las 00:30 de Madrid en verano son las 22:30 UTC del dia ANTERIOR: sin
  -- convertir a la zona del local, este cobro caeria en otro dia y otra hora.
${aislar("timestamptz '2001-07-15 00:30:00+02'")}
  v_json := informe_ventas(timestamptz '2001-07-14 00:00:00+02', timestamptz '2001-07-16 00:00:00+02');
  select (h ->> 'hora')::int into v_dato from jsonb_array_elements(v_json -> 'por_hora') h limit 1;
${comprobarIgual('v_dato', '0', 'las 00:30 de Madrid son la hora 0, no las 22')}
  select d ->> 'dia' into v_txt from jsonb_array_elements(v_json -> 'por_dia') d limit 1;
${comprobarIgual('v_txt', "'2001-07-15'", 'y el dia es el 15, no el 14')}
`,
  },

  {
    nombre: 'el desglose por método incluye lo devuelto, para que cuadre con el arqueo',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa()}
${linea('Racion', '15.00')}
${cobrar('15.00')}
  perform emitir_rectificativa(v_id, 'Mitad', 5.00, 'efectivo', 'Ana');
${aislar()}
  v_json := informe_ventas(${PERIODO});
  select (m ->> 'importe')::numeric into v_dato
    from jsonb_array_elements(v_json -> 'por_metodo') m where m ->> 'metodo' = 'efectivo';
${comprobarIgual('v_dato', '10.00', 'en el cajon quedan 15 menos los 5 devueltos')}
`,
  },

  {
    nombre: 'los productos se agrupan por nombre y se ordenan por importe',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa()}
${linea('Cana', '2.00', 3)}
${linea('Cana', '2.00', 2)}
${linea('Vino', '3.00', 1)}
${cobrar('13.00')}
${aislar()}
  v_json := informe_ventas(${PERIODO});
  select (p ->> 'uds')::numeric into v_dato
    from jsonb_array_elements(v_json -> 'por_producto') p where p ->> 'nombre' = 'Cana';
${comprobarIgual('v_dato', '5', 'las dos lineas de cana se suman en una')}
  select p ->> 'nombre' into v_txt from jsonb_array_elements(v_json -> 'por_producto') p limit 1;
${comprobarIgual('v_txt', "'Cana'", 'lo que mas factura va primero')}
`,
  },

  {
    nombre: 'un periodo sin ventas devuelve ceros, no se rompe',
    cuerpo: ({ comprobarIgual }) => `
  v_json := informe_ventas(timestamptz '1999-01-01', timestamptz '1999-01-02');
${comprobarIgual("(v_json #>> '{resumen,tickets}')::int", '0', 'cero tickets')}
${comprobarIgual("(v_json #>> '{resumen,bruto}')::numeric", '0', 'cero facturado, y no null')}
${comprobarIgual("jsonb_array_length(v_json -> 'por_producto')", '0', 'la lista viene vacia, no null')}
${comprobarIgual("jsonb_array_length(v_json -> 'por_hora')", '0', 'y la de horas tambien')}
`,
  },

  {
    nombre: 'el informe es de TU bar y de nadie más',
    cuerpo: ({ comprobarIgual }) => `
${montarMesa()}
${linea('Algo', '30.00')}
${cobrar('30.00')}
${aislar()}
  -- la sesion pasa a ser de otro local: no puede ver estas ventas
  perform set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('local_id', gen_random_uuid()))::text, true);
  v_json := informe_ventas(${PERIODO});
${comprobarIgual("(v_json #>> '{resumen,bruto}')::numeric", '0', 'otro local no ve ni un euro')}
`,
  },
]
