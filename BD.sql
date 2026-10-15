-- AquaControl: esquema completo para PostgreSQL / Supabase.
-- Se puede correr sobre una BD vacía o sobre una que ya tenga la versión anterior:
-- todo usa IF NOT EXISTS / CREATE OR REPLACE, así que conserva los datos.

-- pgcrypto: gen_random_bytes() y digest() para los tokens de los dispositivos.
-- En Supabase ya viene instalada en el esquema "extensions".
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Si ya tenías la BD vieja (la de las series matemáticas), descomentá este bloque
-- para borrar las tablas que ya no se usan. La tabla cliente se conserva.
-- DROP TABLE IF EXISTS serie_leibniz;
-- DROP TABLE IF EXISTS serie_fibonacci;
-- DROP TABLE IF EXISTS serie_taylor;

-- =====================================================================
-- Tablas
-- =====================================================================

-- Tabla cliente (también actúa como usuario: se registra y hace login con email/password)
CREATE TABLE IF NOT EXISTS cliente (
    id_cliente      SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    identificador   VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    fecha_registro  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Fase 2: roles (usuario / admin) y cuentas suspendidas
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS rol VARCHAR(10) NOT NULL DEFAULT 'usuario';
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE cliente DROP CONSTRAINT IF EXISTS chk_cliente_rol;
ALTER TABLE cliente ADD CONSTRAINT chk_cliente_rol CHECK (rol IN ('usuario', 'admin'));

-- Cada ESP32. Existe desde que se anuncia por primera vez (estado 'pendiente',
-- sin dueño); al vincularlo desde el dashboard pasa a 'vinculado'.
CREATE TABLE IF NOT EXISTS dispositivo (
    id_dispositivo   SERIAL PRIMARY KEY,
    id_cliente       INT REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    nombre           VARCHAR(100),
    token_hash       CHAR(64) UNIQUE,               -- SHA-256 en hex del token del dispositivo
    pulsos_por_litro DECIMAL(8,3) NOT NULL DEFAULT 450,
    ultima_conexion  TIMESTAMPTZ,
    fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La versión anterior tenía la clave API copiada a mano (api_key_hash) y el
-- dispositivo nacía ya con dueño y nombre
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'dispositivo'
               AND column_name = 'api_key_hash') THEN
    ALTER TABLE dispositivo RENAME COLUMN api_key_hash TO token_hash;
  END IF;
END $$;
ALTER TABLE dispositivo ALTER COLUMN id_cliente DROP NOT NULL;
ALTER TABLE dispositivo ALTER COLUMN nombre DROP NOT NULL;
ALTER TABLE dispositivo ALTER COLUMN token_hash DROP NOT NULL;

ALTER TABLE dispositivo ADD COLUMN IF NOT EXISTS mac CHAR(17) UNIQUE;
ALTER TABLE dispositivo ADD COLUMN IF NOT EXISTS codigo_vinculo CHAR(6) UNIQUE;
ALTER TABLE dispositivo ADD COLUMN IF NOT EXISTS estado VARCHAR(10) NOT NULL DEFAULT 'pendiente';
ALTER TABLE dispositivo ADD COLUMN IF NOT EXISTS limite_diario_l DECIMAL(10,3);
ALTER TABLE dispositivo ADD COLUMN IF NOT EXISTS valvula_modo VARCHAR(10) NOT NULL DEFAULT 'auto';
ALTER TABLE dispositivo ADD COLUMN IF NOT EXISTS ultimo_anuncio TIMESTAMPTZ;
-- Dispositivos de la versión anterior (con dueño y sin MAC) siguen vinculados
UPDATE dispositivo SET estado = 'vinculado' WHERE id_cliente IS NOT NULL AND mac IS NULL;

ALTER TABLE dispositivo DROP CONSTRAINT IF EXISTS chk_dispositivo_estado;
ALTER TABLE dispositivo ADD CONSTRAINT chk_dispositivo_estado CHECK (estado IN ('pendiente', 'vinculado'));
ALTER TABLE dispositivo DROP CONSTRAINT IF EXISTS chk_dispositivo_valvula_modo;
ALTER TABLE dispositivo ADD CONSTRAINT chk_dispositivo_valvula_modo CHECK (valvula_modo IN ('auto', 'abierta', 'cerrada'));
ALTER TABLE dispositivo DROP CONSTRAINT IF EXISTS chk_dispositivo_valores;
ALTER TABLE dispositivo ADD CONSTRAINT chk_dispositivo_valores
  CHECK (pulsos_por_litro > 0 AND (limite_diario_l IS NULL OR limite_diario_l > 0));
ALTER TABLE dispositivo DROP CONSTRAINT IF EXISTS chk_dispositivo_vinculado;
ALTER TABLE dispositivo ADD CONSTRAINT chk_dispositivo_vinculado
  CHECK (estado = 'pendiente' OR (id_cliente IS NOT NULL AND nombre IS NOT NULL));

-- Cada lectura del ESP32 (una cada 2 s, con el promedio del intervalo y el
-- estado de los actuadores en ese momento)
CREATE TABLE IF NOT EXISTS lectura_caudal (
    id_lectura       BIGSERIAL PRIMARY KEY,
    id_dispositivo   INT NOT NULL REFERENCES dispositivo(id_dispositivo) ON DELETE CASCADE,
    caudal_lmin      DECIMAL(10,3) NOT NULL,
    volumen_l        DECIMAL(14,3) NOT NULL,   -- volumen acumulado reportado por el ESP32
    pulsos           INT NOT NULL,             -- pulsos contados en ese intervalo
    fecha_medicion   TIMESTAMPTZ NOT NULL,     -- calculada por el servidor (momento de recepción - ms_atras)
    fecha_recepcion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lectura_caudal ADD COLUMN IF NOT EXISTS nivel_agua SMALLINT;          -- T1592, 0 a 4095
ALTER TABLE lectura_caudal ADD COLUMN IF NOT EXISTS fuga BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE lectura_caudal ADD COLUMN IF NOT EXISTS valvula_abierta BOOLEAN;
ALTER TABLE lectura_caudal ADD COLUMN IF NOT EXISTS led_estado VARCHAR(15);
ALTER TABLE lectura_caudal ADD COLUMN IF NOT EXISTS led_brillo SMALLINT;           -- 0 a 100 %

ALTER TABLE lectura_caudal DROP CONSTRAINT IF EXISTS chk_lectura_valores;
ALTER TABLE lectura_caudal ADD CONSTRAINT chk_lectura_valores CHECK (
  caudal_lmin >= 0 AND volumen_l >= 0 AND pulsos >= 0
  AND (nivel_agua IS NULL OR nivel_agua BETWEEN 0 AND 4095)
  AND (led_brillo IS NULL OR led_brillo BETWEEN 0 AND 100));
ALTER TABLE lectura_caudal DROP CONSTRAINT IF EXISTS chk_lectura_led;
ALTER TABLE lectura_caudal ADD CONSTRAINT chk_lectura_led CHECK (led_estado IS NULL OR led_estado IN
  ('apagado', 'verde', 'amarillo', 'rojo', 'limite', 'fuga', 'vinculando'));

-- Alertas y acciones relevantes
CREATE TABLE IF NOT EXISTS evento (
    id_evento      BIGSERIAL PRIMARY KEY,
    id_dispositivo INT NOT NULL REFERENCES dispositivo(id_dispositivo) ON DELETE CASCADE,
    tipo           VARCHAR(20) NOT NULL CHECK (tipo IN ('FUGA', 'LIMITE', 'FLUJO_CONTINUO', 'VALVULA')),
    detalle        VARCHAR(255),
    fecha          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atendido       BOOLEAN NOT NULL DEFAULT FALSE
);

-- Índices para consultas del dashboard (dispositivos del cliente y lecturas por rango de fechas)
CREATE INDEX IF NOT EXISTS idx_dispositivo_cliente ON dispositivo(id_cliente);
CREATE INDEX IF NOT EXISTS idx_lectura_dispositivo_fecha ON lectura_caudal(id_dispositivo, fecha_medicion DESC);
CREATE INDEX IF NOT EXISTS idx_evento_dispositivo_fecha ON evento(id_dispositivo, fecha DESC);

-- =====================================================================
-- Funciones que usa el ESP32 a través de la API REST de Supabase
--   POST /rest/v1/rpc/anunciar_dispositivo   { "p_mac": "..." }
--   POST /rest/v1/rpc/registrar_lecturas     { "p_token": "...", "p_lecturas": [...] }
-- Son SECURITY DEFINER: corren con los permisos del dueño, así el rol anon
-- (la clave pública que lleva el firmware) no necesita acceso a ninguna tabla.
-- =====================================================================

-- El ESP32 se anuncia con su MAC. Mientras nadie lo vincule recibe su código
-- de 6 caracteres; cuando un usuario lo vincula, recibe su token una sola vez.
CREATE OR REPLACE FUNCTION anunciar_dispositivo(p_mac text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_mac   text := upper(trim(coalesce(p_mac, '')));
  d       dispositivo;
  v_token text;
BEGIN
  IF v_mac !~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$' THEN
    RAISE EXCEPTION 'mac invalida: se espera el formato AA:BB:CC:DD:EE:FF';
  END IF;

  -- Los anuncios que nadie vinculó en un día se descartan
  DELETE FROM dispositivo
   WHERE estado = 'pendiente' AND ultimo_anuncio < now() - interval '1 day' AND mac <> v_mac;

  INSERT INTO dispositivo (mac, codigo_vinculo, estado, ultimo_anuncio)
  VALUES (v_mac, replace(right(v_mac, 8), ':', ''), 'pendiente', now())
  ON CONFLICT (mac) DO UPDATE SET ultimo_anuncio = now()
  RETURNING * INTO d;

  IF d.estado = 'pendiente' THEN
    RETURN jsonb_build_object('estado', 'pendiente', 'codigo', d.codigo_vinculo);
  END IF;

  IF d.token_hash IS NOT NULL THEN
    -- Ya se le entregó su token. Si el ESP32 lo perdió, hay que desvincularlo
    -- desde el dashboard y volver a vincularlo.
    RETURN jsonb_build_object('estado', 'vinculado');
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  UPDATE dispositivo
     SET token_hash = encode(digest(v_token, 'sha256'), 'hex')
   WHERE id_dispositivo = d.id_dispositivo;
  RETURN jsonb_build_object('estado', 'vinculado', 'token', v_token, 'nombre', d.nombre);
END;
$$;

-- Litros consumidos hoy (día de Bolivia) por un dispositivo
CREATE OR REPLACE FUNCTION consumo_hoy_l(p_id_dispositivo int)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT round(coalesce(sum(l.pulsos), 0) / d.pulsos_por_litro, 3)
    FROM dispositivo d
    LEFT JOIN lectura_caudal l
      ON l.id_dispositivo = d.id_dispositivo
     AND l.fecha_medicion >= date_trunc('day', now() AT TIME ZONE 'America/La_Paz') AT TIME ZONE 'America/La_Paz'
   WHERE d.id_dispositivo = p_id_dispositivo
   GROUP BY d.pulsos_por_litro;
$$;

-- Estado que el ESP32 tiene que aplicar y que el dashboard muestra:
-- la válvula se cierra si hay una fuga sin confirmar, si el usuario la cerró
-- o si en modo automático se alcanzó el límite del día.
CREATE OR REPLACE FUNCTION estado_dispositivo(p_id_dispositivo int)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  d        dispositivo;
  v_consumo numeric;
  v_fugas  int;
  v_motivo text;
BEGIN
  SELECT * INTO d FROM dispositivo WHERE id_dispositivo = p_id_dispositivo;
  v_consumo := coalesce(consumo_hoy_l(p_id_dispositivo), 0);
  SELECT count(*) INTO v_fugas FROM evento
   WHERE id_dispositivo = p_id_dispositivo AND tipo = 'FUGA' AND NOT atendido;

  v_motivo := CASE
    WHEN v_fugas > 0 THEN 'fuga'
    WHEN d.valvula_modo = 'cerrada' THEN 'manual'
    WHEN d.valvula_modo = 'auto' AND d.limite_diario_l IS NOT NULL
         AND v_consumo >= d.limite_diario_l THEN 'limite'
  END;

  RETURN jsonb_build_object(
    'valvula', CASE WHEN v_motivo IS NULL THEN 'abrir' ELSE 'cerrar' END,
    'motivo', v_motivo,
    'modo', d.valvula_modo,
    'limite_diario_l', d.limite_diario_l,
    'consumo_hoy_l', v_consumo,
    'fugas_pendientes', v_fugas,
    'pulsos_por_litro', d.pulsos_por_litro);
END;
$$;

CREATE OR REPLACE FUNCTION registrar_lecturas(p_token text, p_lecturas jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  d        dispositivo;
  v_n      int;
  v_estado jsonb;
  v_ultima lectura_caudal;
  v_inicio_dia timestamptz := date_trunc('day', now() AT TIME ZONE 'America/La_Paz') AT TIME ZONE 'America/La_Paz';
BEGIN
  SELECT * INTO d FROM dispositivo
   WHERE token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     AND estado = 'vinculado';
  IF NOT FOUND THEN
    -- El ESP32 busca la palabra "token" para borrar el suyo y volver a anunciarse
    RAISE EXCEPTION 'token invalido';
  END IF;

  IF jsonb_typeof(p_lecturas) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_lecturas) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'p_lecturas debe ser un arreglo de 1 a 120 lecturas';
  END IF;

  -- Las restricciones CHECK de la tabla rechazan valores fuera de rango
  INSERT INTO lectura_caudal (id_dispositivo, caudal_lmin, volumen_l, pulsos, nivel_agua, fuga,
                              valvula_abierta, led_estado, led_brillo, fecha_medicion)
  SELECT d.id_dispositivo, r.caudal_lmin, r.volumen_l, r.pulsos, r.nivel_agua, coalesce(r.fuga, false),
         r.valvula_abierta, r.led_estado, r.led_brillo,
         -- El ESP32 no tiene reloj real: manda hace cuántos ms midió (máximo 24 h)
         now() - make_interval(secs => least(greatest(coalesce(r.ms_atras, 0), 0), 86400000) / 1000.0)
    FROM jsonb_to_recordset(p_lecturas) AS r(
         caudal_lmin numeric, volumen_l numeric, pulsos int, nivel_agua int, fuga boolean,
         valvula_abierta boolean, led_estado text, led_brillo int, ms_atras bigint);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE dispositivo SET ultima_conexion = now() WHERE id_dispositivo = d.id_dispositivo;

  -- Eventos
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_lecturas) e WHERE (e->>'fuga')::boolean)
     AND NOT EXISTS (SELECT 1 FROM evento WHERE id_dispositivo = d.id_dispositivo
                                           AND tipo = 'FUGA' AND NOT atendido) THEN
    INSERT INTO evento (id_dispositivo, tipo, detalle)
    VALUES (d.id_dispositivo, 'FUGA', 'El sensor T1592 detectó agua en el piso; la válvula se cerró');
  END IF;

  IF d.limite_diario_l IS NOT NULL
     AND consumo_hoy_l(d.id_dispositivo) >= d.limite_diario_l
     AND NOT EXISTS (SELECT 1 FROM evento WHERE id_dispositivo = d.id_dispositivo
                                           AND tipo = 'LIMITE' AND fecha >= v_inicio_dia) THEN
    INSERT INTO evento (id_dispositivo, tipo, detalle)
    VALUES (d.id_dispositivo, 'LIMITE', format('Se alcanzó el límite diario de %s L', d.limite_diario_l));
  END IF;

  -- Fuga interna: el agua no dejó de correr en 30 minutos (grifo goteando, inodoro)
  IF (p_lecturas->-1->>'caudal_lmin')::numeric > 0
     AND NOT EXISTS (SELECT 1 FROM evento WHERE id_dispositivo = d.id_dispositivo
                                           AND tipo = 'FLUJO_CONTINUO' AND fecha >= now() - interval '1 hour')
     AND (SELECT count(*) FROM lectura_caudal WHERE id_dispositivo = d.id_dispositivo
                                                AND fecha_medicion >= now() - interval '30 minutes') >= 300
     AND NOT EXISTS (SELECT 1 FROM lectura_caudal WHERE id_dispositivo = d.id_dispositivo
                                                    AND fecha_medicion >= now() - interval '30 minutes'
                                                    AND caudal_lmin = 0) THEN
    INSERT INTO evento (id_dispositivo, tipo, detalle)
    VALUES (d.id_dispositivo, 'FLUJO_CONTINUO', 'El agua lleva 30 minutos corriendo sin parar');
  END IF;

  -- Con una lectura cada 2 s se suman ~43 000 filas por día y por dispositivo.
  -- De vez en cuando (1 de cada 100 envíos) se borran las de más de 30 días,
  -- para no llenar los 500 MB del plan gratuito de Supabase.
  IF random() < 0.01 THEN
    DELETE FROM lectura_caudal
     WHERE id_dispositivo = d.id_dispositivo AND fecha_medicion < now() - interval '30 days';
  END IF;

  v_estado := estado_dispositivo(d.id_dispositivo);

  -- Aviso al servidor (LISTEN nueva_lectura) para los dashboards abiertos
  SELECT * INTO v_ultima FROM lectura_caudal
   WHERE id_dispositivo = d.id_dispositivo ORDER BY id_lectura DESC LIMIT 1;
  PERFORM pg_notify('nueva_lectura', jsonb_build_object(
    'id_dispositivo', d.id_dispositivo,
    'lectura', to_jsonb(v_ultima) - 'id_dispositivo',
    'estado', v_estado)::text);

  RETURN jsonb_build_object('guardadas', v_n) || v_estado;
END;
$$;

-- =====================================================================
-- Seguridad
-- Supabase publica las tablas del esquema public en su API REST. Con RLS
-- activado y sin políticas para anon/authenticated, esa API no puede leer ni
-- escribir ninguna fila. El back-end se conecta con el rol postgres (dueño de
-- las tablas), que no está sujeto a RLS, y filtra por usuario en cada consulta.
-- =====================================================================

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END $$;

-- El ESP32 (rol anon) solo puede ejecutar estas dos funciones
REVOKE ALL ON FUNCTION anunciar_dispositivo(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION registrar_lecturas(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION estado_dispositivo(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION consumo_hoy_l(int) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION estado_dispositivo(int), consumo_hoy_l(int) FROM anon, authenticated;
    GRANT EXECUTE ON FUNCTION anunciar_dispositivo(text), registrar_lecturas(text, jsonb) TO anon;
  END IF;
END $$;

-- Primer superadmin (correr a mano en el editor SQL de Supabase):
-- UPDATE cliente SET rol = 'admin' WHERE email = 'tu-email@ejemplo.com';
