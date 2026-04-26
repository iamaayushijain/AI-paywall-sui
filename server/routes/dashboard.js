import { Router } from "express";
import { getAllPayments, getTotalLamports } from "../data/payments.js";

const router = Router();

router.get("/", (_req, res) => {
  const payments = getAllPayments();
  res.json({
    total: payments.length,
    total_lamports: getTotalLamports(),
    payments,
  });
});

export default router;
