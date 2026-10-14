import { Router } from "express";
import authRoutes from "./auth.routes";
import clienteRoutes from "./cliente.routes";
import dispositivoRoutes from "./dispositivo.routes";
import streamRoutes from "./stream.routes";
import adminRoutes from "./admin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/clientes", clienteRoutes);
router.use("/dispositivos", dispositivoRoutes);
router.use("/stream", streamRoutes);
router.use("/admin", adminRoutes);

export default router;
