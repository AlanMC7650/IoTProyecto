import "reflect-metadata";
import express from "express";
import cors from "cors";
import fs from "fs";
import os from "os";
import path from "path";
import * as dotenv from "dotenv";
import { AppDataSource } from "./config/data-source";
import router from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { RealtimeService } from "./services/realtime.service";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);

// Build del Front (Front/dist copiado a Back/public) servido por Express
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const INDEX_HTML = path.join(PUBLIC_DIR, "index.html");
if (fs.existsSync(INDEX_HTML)) {
  app.use(express.static(PUBLIC_DIR));
  // SPA fallback: cualquier ruta que no sea de la API devuelve el index.html
  app.get(/^(?!\/api(\/|$)).*/, (_req, res) => {
    res.sendFile(INDEX_HTML);
  });
}

app.use(errorHandler);

function ipsLocales(): string[] {
  const ips: string[] = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const i of interfaces ?? []) {
      if (i.family === "IPv4" && !i.internal) ips.push(i.address);
    }
  }
  return ips;
}

AppDataSource.initialize()
  .then(() => {
    console.log("Conexión a Postgres establecida");
    RealtimeService.iniciar();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
      console.log(`  En esta PC:  http://localhost:${PORT}`);
      for (const ip of ipsLocales()) {
        console.log(`  En la red:   http://${ip}:${PORT}`);
      }
      console.log("  Desde Internet: `npm run tunnel` en otra terminal (ngrok)");
      if (!fs.existsSync(INDEX_HTML)) {
        console.log("Aviso: no existe Back/public, la web no se sirve desde acá (correr `npm run front`)");
      }
    });
  })
  .catch((error) => {
    console.error("Error al conectar a la base de datos:", error);
  });
