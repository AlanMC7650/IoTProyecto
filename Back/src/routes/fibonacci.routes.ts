import { Router } from "express";
import { FibonacciController } from "../controllers/fibonacci.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.post("/generar", FibonacciController.generar);
router.get("/mias", FibonacciController.listarMias);
router.get("/mias/ejecuciones", FibonacciController.listarEjecuciones);
router.get("/ejecucion/:id_ejecucion", FibonacciController.listarPorEjecucion);
router.delete("/ejecucion/:id_ejecucion", FibonacciController.eliminarEjecucion);

export default router;
