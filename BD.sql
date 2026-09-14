-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla cliente (también actúa como usuario: se registra y hace login con email/password)
CREATE TABLE cliente (
    id_cliente      SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    identificador   VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    fecha_registro  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Serie de Leibniz (aproximación de Pi)
CREATE TABLE serie_leibniz (
    id_leibniz        SERIAL PRIMARY KEY,
    id_cliente        INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_ejecucion      UUID NOT NULL DEFAULT gen_random_uuid(),
    iteracion         INT NOT NULL,
    valor_calculado   DECIMAL(20,15) NOT NULL,
    valor_real        DECIMAL(20,15) NOT NULL,
    error             DECIMAL(20,15) NOT NULL,
    fecha_generacion  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Serie de Fibonacci (razón áurea)
CREATE TABLE serie_fibonacci (
    id_fibonacci      SERIAL PRIMARY KEY,
    id_cliente        INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_ejecucion      UUID NOT NULL DEFAULT gen_random_uuid(),
    iteracion         INT NOT NULL,
    fibonacci_n       BIGINT NOT NULL,
    razon_calculada   DECIMAL(20,15) NOT NULL,
    valor_real        DECIMAL(20,15) NOT NULL,
    error             DECIMAL(20,15) NOT NULL,
    fecha_generacion  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Serie de Taylor (función configurable)
CREATE TABLE serie_taylor (
    id_taylor         SERIAL PRIMARY KEY,
    id_cliente        INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_ejecucion      UUID NOT NULL DEFAULT gen_random_uuid(),
    funcion           VARCHAR(20) NOT NULL CHECK (funcion IN ('exponencial', 'seno', 'coseno')),
    x_valor           DECIMAL(10,6) NOT NULL,
    iteracion         INT NOT NULL,
    valor_calculado   DECIMAL(20,15) NOT NULL,
    valor_real        DECIMAL(20,15) NOT NULL,
    error             DECIMAL(20,15) NOT NULL,
    fecha_generacion  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para consultas del dashboard (por cliente y por ejecución)
CREATE INDEX idx_leibniz_cliente ON serie_leibniz(id_cliente);
CREATE INDEX idx_leibniz_ejecucion ON serie_leibniz(id_ejecucion);

CREATE INDEX idx_fibonacci_cliente ON serie_fibonacci(id_cliente);
CREATE INDEX idx_fibonacci_ejecucion ON serie_fibonacci(id_ejecucion);

CREATE INDEX idx_taylor_cliente ON serie_taylor(id_cliente);
CREATE INDEX idx_taylor_ejecucion ON serie_taylor(id_ejecucion);