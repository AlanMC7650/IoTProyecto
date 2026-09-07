import { Router } from "express";
import { ClienteController } from "../controllers/cliente.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/me", authMiddleware, ClienteController.obtenerPerfil);

export default router;
