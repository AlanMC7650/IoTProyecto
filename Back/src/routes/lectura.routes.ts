import { Router } from "express";
import { LecturaController } from "../controllers/lectura.controller";
import { deviceAuthMiddleware } from "../middlewares/deviceAuth.middleware";

const router = Router();

router.post("/", deviceAuthMiddleware, LecturaController.registrar);

export default router;
