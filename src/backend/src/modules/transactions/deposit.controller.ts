import type { Request, Response } from "express";

export async function createDepositIntent(req: Request, res: Response) {
  // Compliance/provider gate:
  // A production implementation must first verify that the operator,
  // payment method and jurisdiction are authorized for this use.
  // No wallet credit occurs here.
  res.status(202).json({
    ok: true,
    data: {
      status: "pending",
      message: "Deposit intent created; awaiting authorized provider verification.",
    },
  });
}
