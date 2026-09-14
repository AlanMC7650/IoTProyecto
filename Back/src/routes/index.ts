import { Router } from "express";
import authRoutes from "./auth.routes";
import clienteRoutes from "./cliente.routes";
import leibnizRoutes from "./leibniz.routes";
import fibonacciRoutes from "./fibonacci.routes";
import taylorRoutes from "./taylor.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/clientes", clienteRoutes);
router.use("/series/leibniz", leibnizRoutes);
router.use("/series/fibonacci", fibonacciRoutes);
router.use("/series/taylor", taylorRoutes);

export default router;
