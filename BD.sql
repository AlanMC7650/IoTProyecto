-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Si ya tenías la BD vieja (la de las series matemáticas), descomentá este bloque
-- para borrar las tablas que ya no se usan. La tabla cliente se conserva.
-- DROP TABLE IF EXISTS serie_leibniz;
-- DROP TABLE IF EXISTS serie_fibonacci;
-- DROP TABLE IF EXISTS serie_taylor;

-- Tabla cliente (también actúa como usuario: se registra y hace login con email/password)
CREATE TABLE IF NOT EXISTS cliente (
    id_cliente      SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    identificador   VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    fecha_registro  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Cada ESP32 registrado por un cliente
CREATE TABLE IF NOT EXISTS dispositivo (
    id_dispositivo   SERIAL PRIMARY KEY,
    id_cliente       INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    nombre           VARCHAR(100) NOT NULL,
    api_key_hash     CHAR(64) UNIQUE NOT NULL,      -- SHA-256 en hex de la clave API
    pulsos_por_litro DECIMAL(8,3) NOT NULL DEFAULT 450,
    ultima_conexion  TIMESTAMPTZ,
    fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cada medición del sensor (una por segundo)
CREATE TABLE IF NOT EXISTS lectura_caudal (
    id_lectura       BIGSERIAL PRIMARY KEY,
    id_dispositivo   INT NOT NULL REFERENCES dispositivo(id_dispositivo) ON DELETE CASCADE,
    caudal_lmin      DECIMAL(10,3) NOT NULL,
    volumen_l        DECIMAL(14,3) NOT NULL,   -- volumen acumulado reportado por el ESP32
    pulsos           INT NOT NULL,             -- pulsos contados en ese intervalo
    fecha_medicion   TIMESTAMPTZ NOT NULL,     -- calculada por el servidor (momento de recepción - ms_atras)
    fecha_recepcion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas del dashboard (dispositivos del cliente y lecturas por rango de fechas)
CREATE INDEX IF NOT EXISTS idx_dispositivo_cliente ON dispositivo(id_cliente);
CREATE INDEX IF NOT EXISTS idx_lectura_dispositivo_fecha ON lectura_caudal(id_dispositivo, fecha_medicion DESC);
