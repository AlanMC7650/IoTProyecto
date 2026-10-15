# Cómo compartir esta app con alguien (deploy con ngrok)

Guía para exponer la app corriendo en tu máquina a través de un link público de ngrok, sin necesidad de un deploy real. Pensada para compartirle el link a alguien que no es programador, solo mientras tu máquina esté prendida y los procesos corriendo.

## Arquitectura

La app tiene 3 partes que corren en tu máquina:

- **Back** (Express + TypeORM + Postgres): puerto `3000`, expone la API en `/api/...`.
- **Front** (Vite + React): puerto `5173` en desarrollo.
- **Postgres**: local, no se expone a internet — solo el backend le habla.

## Idea clave: un solo túnel, no dos

Al principio intentamos exponer backend y frontend cada uno con su propio túnel ngrok. Esto falló porque **la cuenta gratuita de ngrok puede asignar el mismo dominio ephemeral a ambos túneles**, rompiendo el enrutamiento.

La solución fue hacer que **Vite actúe de proxy**: el navegador le habla siempre al frontend (mismo origen), y Vite reenvía internamente todo lo que empieza con `/api` hacia `http://localhost:3000`. Así:

- Solo hace falta **un túnel ngrok** (el del frontend).
- No hay problemas de CORS (todo es mismo origen desde el navegador).
- El backend nunca se expone directamente a internet.

Esto se configuró en [Front/vite.config.ts](../Front/vite.config.ts):

```ts
server: {
  host: true,           // permite conexiones desde fuera de localhost
  allowedHosts: true,   // Vite bloquea hosts desconocidos (como el dominio de ngrok) por defecto; esto lo permite
  proxy: {
    "/api": {
      target: "http://localhost:3000",
      changeOrigin: true,
    },
  },
},
```

Y en [Front/.env](../Front/.env), la URL de la API pasó a ser relativa:

```
VITE_API_URL=/api
```

(antes era `http://localhost:3000/api`, lo cual solo funciona en local — con el proxy de Vite, `/api` relativo funciona tanto en local como detrás de ngrok).

## Setup de ngrok (una sola vez)

1. Crear cuenta gratis: https://dashboard.ngrok.com/signup
2. Copiar el authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
3. Guardar el token en `Back/ngrok.yml` (este archivo está en `.gitignore`, **nunca se sube al repo** porque contiene un secreto):

```yaml
version: "2"
authtoken: TU_TOKEN_AQUI
tunnels:
  frontend:
    proto: http
    addr: 5173
```

Alternativa: correr `ngrok config add-authtoken TU_TOKEN` una vez, así el token queda guardado en la config global de ngrok (`%LOCALAPPDATA%\ngrok\ngrok.yml`) y no hace falta ponerlo en el `.yml` del proyecto.

## Pasos para desplegar (cada vez que quieras compartir un link)

Necesitás **3 terminales abiertas al mismo tiempo**, cada una corriendo su proceso sin cerrarse:

**Terminal 1 — Backend:**
```
cd Back
npm run dev
```

**Terminal 2 — Frontend:**
```
cd Front
npm run dev
```

**Terminal 3 — ngrok** (parado en la raíz del proyecto, `App/`):
```
ngrok start --all --config Back/ngrok.yml
```

## Obtener el link para compartir

En la terminal de ngrok vas a ver una sección `Forwarding` con la URL pública, por ejemplo:

```
Forwarding    https://algo-random.ngrok-free.dev -> http://localhost:5173
```

Esa URL (`https://algo-random.ngrok-free.dev`) es la que le pasás a la otra persona.

Si la terminal no muestra el detalle (o querés confirmarlo por otra vía), se puede consultar la API local del agente de ngrok, que siempre está en `http://127.0.0.1:4040`:

```
curl http://127.0.0.1:4040/api/tunnels
```

Devuelve un JSON con el/los túneles activos y su `public_url`.

**Aviso para la persona que abre el link**: la primera vez, ngrok gratis muestra una pantalla de advertencia ("You are about to visit...") — hay que tocar "Visit Site" para entrar. Es normal, pasa siempre con el plan gratuito.

## Errores que nos encontramos (y cómo se resolvieron)

- **`open .../Back\Back\ngrok.yml: The system cannot find the path specified`**: pasa el `--config` con una ruta relativa a `Back/ngrok.yml` mientras la terminal ya estaba parada *dentro* de `Back/`, duplicando la carpeta en la ruta. Solución: correr `ngrok start --all --config ngrok.yml` (sin el prefijo) si ya estás en `Back/`, o `--config Back/ngrok.yml` si estás en la raíz `App/`.
- **`ERR_NGROK_4018` (sesión no autenticada)**: faltaba el authtoken. Se soluciona agregando `authtoken: ...` al `ngrok.yml`, o corriendo `ngrok config add-authtoken TU_TOKEN` una vez.
- **`Blocked request. This host is not allowed`**: Vite rechaza por seguridad pedidos con un host que no reconoce (como el subdominio de ngrok). Se soluciona con `allowedHosts: true` en `vite.config.ts`.
- **Backend y frontend con la misma `public_url` en ngrok**: limitación del plan gratuito al levantar 2 túneles HTTP simultáneos sin dominio reservado. Se resolvió eliminando el túnel del backend y usando el proxy de Vite (ver arriba), así solo se necesita un túnel.

## Notas de seguridad

- `Back/.env` (credenciales de la base de datos, JWT secret) y `Back/ngrok.yml` (authtoken de ngrok) están en `.gitignore` — nunca deberían terminar commiteados.
- El link de ngrok gratuito es público: cualquiera que lo tenga puede acceder mientras el túnel esté activo. Al cortar cualquiera de las 3 terminales, el link deja de funcionar.
- Cada vez que reiniciás ngrok sin un dominio reservado, la URL cambia — hay que volver a compartir el link nuevo.
