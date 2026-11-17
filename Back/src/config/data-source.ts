import "reflect-metadata";
import path from "path";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config();

// Datos de conexión compartidos por TypeORM y por la escucha en tiempo real.
// Con Supabase se usa el "session pooler" (puerto 5432, funciona en redes IPv4);
// DB_SSL=true cifra la conexión.
export function opcionesConexion() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

const conexion = opcionesConexion();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: conexion.host,
  port: conexion.port,
  username: conexion.user,
  password: conexion.password,
  database: conexion.database,
  ssl: conexion.ssl,
  synchronize: false,
  // Con el ESP32 enviando y la web consultando cada pocos segundos, loguear
  // cada query tapa la consola: se activa solo con DB_LOGGING=true
  logging: process.env.DB_LOGGING === "true" ? true : ["error"],
  // Rutas relativas a este archivo: sirven tanto con ts-node (src/*.ts) como
  // compilado con tsc (dist/*.js, que es lo que corre en Docker)
  entities: [path.join(__dirname, "..", "entities", "**", "*.{ts,js}")],
  migrations: [path.join(__dirname, "..", "migrations", "**", "*.{ts,js}")],
});
