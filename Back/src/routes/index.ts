import { Router } from "express";
import authRoutes from "./auth.routes";
import clienteRoutes from "./cliente.routes";
import dispositivoRoutes from "./dispositivo.routes";
import lecturaRoutes from "./lectura.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/clientes", clienteRoutes);
router.use("/dispositivos", dispositivoRoutes);
router.use("/lecturas", lecturaRoutes);

export default router;
