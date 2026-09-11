import { Router } from "express";
import { LeibnizController } from "../controllers/leibniz.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.post("/generar", LeibnizController.generar);
router.get("/mias", LeibnizController.listarMias);
router.get("/mias/ejecuciones", LeibnizController.listarEjecuciones);
router.get("/ejecucion/:id_ejecucion", LeibnizController.listarPorEjecucion);
router.delete("/ejecucion/:id_ejecucion", LeibnizController.eliminarEjecucion);

export default router;
