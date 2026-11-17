-- Roles que existen en Supabase y que BD.sql espera encontrar.
-- anon es el rol con el que PostgREST atiende al ESP32 (igual que la clave
-- pública de Supabase): solo puede ejecutar anunciar_dispositivo y registrar_lecturas.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
