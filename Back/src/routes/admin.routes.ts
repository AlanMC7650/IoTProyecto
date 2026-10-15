import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { authMiddleware, soloAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware, soloAdmin);

router.get("/usuarios", AdminController.listarUsuarios);
router.get("/usuarios/:id/dispositivos", AdminController.dispositivosDeUsuario);
router.patch("/usuarios/:id", AdminController.cambiarActivo);

export default router;
