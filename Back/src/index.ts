import "reflect-metadata";
import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import { AppDataSource } from "./config/data-source";
import router from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);
app.use(errorHandler);

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