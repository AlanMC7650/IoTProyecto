import { Router } from "express";
import { DispositivoController } from "../controllers/dispositivo.controller";
import { LecturaController } from "../controllers/lectura.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.post("/", DispositivoController.crear);
router.get("/", DispositivoController.listar);
router.patch("/:id", DispositivoController.actualizar);
router.post("/:id/regenerar-clave", DispositivoController.regenerarClave);
router.delete("/:id", DispositivoController.eliminar);

router.get("/:id/ultima", LecturaController.ultima);
router.get("/:id/lecturas", LecturaController.listar);
router.get("/:id/resumen", LecturaController.resumen);

export default router;
