# Locales — un producto, una instalación por bar

Cada bar tiene **su propia instalación**: su proyecto de Supabase, su dominio y
su marca. Lo que **no** tiene es su propia copia del código: eso acabaría en N
repos divergentes donde arreglar un bug son N arreglos.

El modelo es **un solo producto + un perfil por local**. Aquí viven los perfiles.

```
locales/
  _plantilla/perfil.json     ← copia esto para dar de alta un bar
  demo/perfil.json           ← la demo pública
  casa-loli/perfil.json      ← la app real
  bar-manolo/
    perfil.json
    marca/                   ← opcional: logo e iconos de ESTE bar
      logo.svg
      icon-192.png
      icon-512.png
```

## Dar de alta un local

1. `locales/<slug>/perfil.json` — copia de `_plantilla/`. El slug es el nombre
   de la carpeta: minúsculas, números y guiones (`bar-manolo`).
2. Rellena marca, dominio y las claves **de su** proyecto de Supabase.
3. (Opcional) `locales/<slug>/marca/` con `logo.svg` e iconos de 192 y 512 px.
4. `npm run locales` para verlo listado y `npm run locales -- build <slug>`
   para compilarlo.

## Compilar

```bash
npm run locales                       # qué locales hay
npm run locales -- build bar-manolo   # solo ese bar
npm run locales -- build --todos      # todos (es lo que hace el deploy)
LOCAL=bar-manolo npm run build        # equivalente, en bash/CI
```

Sin `LOCAL` se compila la marca genérica con lo que haya en `.env` — el modo de
desarrollo de siempre.

## Campos del perfil

| Campo | Qué es |
|---|---|
| `marca.nombre` | **Obligatorio.** Lo que ve el cliente: portada, pestaña, PWA. |
| `marca.corto` | Nombre bajo el icono de la PWA (≤12 car.). Se deduce si falta. |
| `marca.descripcion` | Subtítulo de la portada y `<meta description>`. |
| `marca.emoji` | Icono de la portada cuando el local no tiene logo. |
| `marca.colores` | `acento` y `acento2` (tema oscuro), `acentoClaro` y `acento2Claro` (tema claro), `fondo` y `tema` (PWA). Hex de 6 dígitos. |
| `despliegue.base` | Ruta pública (`/` en dominio propio, `/tpv-hosteleria/app/` en Pages). |
| `despliegue.url` | Dominio final. Documental, y lo usa el redespliegue. |
| `despliegue.salida` | Carpeta del build. Por defecto `dist/<slug>`. |
| `supabase.ref` / `url` / `anonKey` | Su proyecto. La anon key es pública: la protege el RLS. |
| `backend` | `v2` (multi-tenant, lo normal) o `v1` (blob de la demo). |
| `fiscal` | `verifactu` o `null`. |
| `modulos` | Interruptores por local: `pagosOnline`, `reservas`… |

Lo que venga por **variable de entorno manda sobre el perfil**: así el workflow
inyecta secretos (EmailJS, Stripe) sin meterlos en ficheros versionados.

## Lo que nunca va aquí

Claves de servicio (`service_role`), tokens `sbp_` ni secretos de Stripe. En el
perfil solo va lo que puede viajar al navegador.
