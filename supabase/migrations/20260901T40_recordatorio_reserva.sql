-- ───────────────────────────────────────────────────────────────────────────
-- Marca de que a una reserva ya se le mandó el recordatorio.
--
-- El recordatorio existía —plantilla y todo— pero solo se enviaba pulsando
-- «🔔 Recordar» reserva por reserva. En un bar eso no pasa: es la palanca más
-- eficaz contra el no-show y quedaba a que alguien se acordara.
--
-- Peor aún: la nota de privacidad que el cliente acepta al reservar dice
-- literalmente «(confirmación, cambios y recordatorio)». Se le prometía algo
-- que en la práctica no llegaba.
--
-- Sin esta columna no se puede automatizar: el vigilante pasa cada pocos
-- minutos y mandaría el mismo correo una y otra vez.
-- ───────────────────────────────────────────────────────────────────────────
alter table reservas add column if not exists recordatorio_en timestamptz;

comment on column reservas.recordatorio_en is
  'Cuándo se envió el recordatorio. NULL = todavía no. Lo escribe el vigilante.';
