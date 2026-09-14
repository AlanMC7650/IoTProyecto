import "reflect-metadata";
import express from "express";
import cors from "cors";
import path from "path";
import * as dotenv from "dotenv";
import { AppDataSource } from "./config/data-source";
import router from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Sirve los archivos estáticos del Front ya compilado (carpeta "public")
const frontDistPath = path.join(__dirname, "../public");
app.use(express.static(frontDistPath));

app.use("/api", router);
app.use(errorHandler);

// Fallback: cualquier ruta que NO empiece con /api devuelve el index.html
// del Front, para que React Router maneje la navegación (SPA).
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(frontDistPath, "index.html"));
});

AppDataSource.initialize()
  .then(() => {
    console.log("Conexión a Postgres establecida");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error al conectar a la base de datos:", error);
  });