import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { DispositivoService } from "../services/dispositivo.service";
import { RealtimeService } from "../services/realtime.service";

const router = Router();

// GET /api/stream?dispositivo=3 (Server-Sent Events). El Front lo abre con
// fetch para poder mandar el token en la cabecera Authorization.
router.get("/", authMiddleware, async (req, res) => {
  const id_dispositivo = Number(req.query.dispositivo);
  await DispositivoService.obtenerPropio(id_dispositivo, req.cliente!.id_cliente);
  RealtimeService.suscribir(id_dispositivo, res);
});

export default router;
