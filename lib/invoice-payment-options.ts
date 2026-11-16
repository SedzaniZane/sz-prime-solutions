import { billingContact } from "./billing-contact";

export function invoicePaymentOptions(invoiceNumber: string) {
  const { email } = billingContact();
  return {
    yocoRequestUrl: "mailto:" + email + "?subject=" + encodeURIComponent("Yoco payment link for " + invoiceNumber),
    eft: [
      ["Account holder", "SZ Prime Solutions (Pty) Ltd"],
      ["Bank", "Nedbank"],
      ["Account number", "1349220876"],
      ["Branch code", "198765"],
      ["Payment reference", invoiceNumber],
    ] as const,
  };
}
