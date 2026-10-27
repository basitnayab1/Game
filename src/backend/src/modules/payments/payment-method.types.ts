export type PaymentMethodType = "easypaisa" | "jazzcash" | "bank" | "approved_provider";

export interface PaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  maskedAccount: string;
  verifiedAt?: Date;
  status: "pending" | "verified" | "blocked";
}

/**
 * Payment ownership is verified server-side.
 * Never store unnecessary full payment credentials in the N5 database.
 */
export const paymentSecurityRules = Object.freeze({
  storeOnlyNecessaryData: true,
  maskSensitiveIdentifiers: true,
  ownershipVerificationServerSide: true,
  clientCannotMarkVerified: true,
});
