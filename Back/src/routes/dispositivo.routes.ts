import { Router } from "express";
import { DispositivoController } from "../controllers/dispositivo.controller";
import { LecturaController } from "../controllers/lectura.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.post("/vincular", DispositivoController.vincular);
router.get("/", DispositivoController.listar);
router.patch("/:id", DispositivoController.actualizar);
router.delete("/:id", DispositivoController.desvincular);

router.get("/:id/estado", DispositivoController.estado);
router.post("/:id/valvula", DispositivoController.cambiarValvula);
router.get("/:id/eventos", DispositivoController.eventos);
router.post("/:id/eventos/atender-fugas", DispositivoController.atenderFugas);

router.get("/:id/ultima", LecturaController.ultima);
router.get("/:id/lecturas", LecturaController.listar);
router.get("/:id/resumen", LecturaController.resumen);

export default router;
