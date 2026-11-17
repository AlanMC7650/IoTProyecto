# AquaControl con Docker

Levanta todo el sistema en contenedores, sin instalar Node ni Postgres:

| Servicio    | Qué es                                                   | Puerto en la PC            |
|-------------|----------------------------------------------------------|----------------------------|
| `db`        | PostgreSQL 16 con el esquema de `BD.sql`                 | `127.0.0.1:5433`           |
| `back`      | Express: API (`/api`) + la web (Front compilado)         | `3000`                     |
| `postgrest` | *(perfil `esp32`)* API REST igual a la de Supabase       | interno                    |
| `api-esp32` | *(perfil `esp32`)* expone `/rest/v1/rpc/...` para el ESP32 | `8000`                   |

## Uso

```bash
cp .env.example .env        # opcional: cambiar JWT_SECRET y DB_PASSWORD
docker compose up -d --build
```

Abrir http://localhost:3000. La primera vez la BD se crea vacía y se ejecuta `BD.sql`.

Con la API para el ESP32 / simulador (reemplaza a Supabase en local):

```bash
docker compose --profile esp32 up -d --build
```

En `ESP32/config.py` poner `SUPABASE_URL = "http://<IP-de-la-PC>:8000"` (la clave
`SUPABASE_ANON_KEY` puede ser cualquier texto: en local no se valida). Para el
simulador, en `Back/.env`: `SUPABASE_URL=http://localhost:8000` y `SUPABASE_ANON_KEY=local`.
Igual que en Supabase, el rol `anon` solo puede ejecutar `anunciar_dispositivo`
y `registrar_lecturas`; no lee ninguna tabla.

## Comandos útiles

```bash
docker compose logs -f back                       # ver logs del servidor
docker compose exec db psql -U postgres -d iot    # consola SQL
docker compose exec db psql -U postgres -d iot -c "UPDATE cliente SET rol='admin' WHERE email='tu@email.com'"
docker compose down                               # apagar (conserva los datos)
docker compose down -v                            # apagar y BORRAR la base de datos
```

## Notas

- `BD.sql` solo corre cuando el volumen `db_data` está vacío. Si se cambia el
  esquema: `docker compose exec -T db psql -U postgres -d iot < BD.sql`
  (es idempotente) o `docker compose down -v` para empezar de cero.
- Si el puerto 3000 está ocupado (por ejemplo por `npm run dev`), poner
  `BACK_PORT=3001` en `.env`.
- Para usar Supabase en vez de la BD local, no hace falta Docker para la BD:
  seguir usando `npm run dev` con `Back/.env` apuntando a Supabase.
