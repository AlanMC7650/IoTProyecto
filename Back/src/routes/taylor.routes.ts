import { Router } from "express";
import { TaylorController } from "../controllers/taylor.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.post("/generar", TaylorController.generar);
router.get("/mias", TaylorController.listarMias);
router.get("/mias/ejecuciones", TaylorController.listarEjecuciones);
router.get("/ejecucion/:id_ejecucion", TaylorController.listarPorEjecucion);

export default router;
