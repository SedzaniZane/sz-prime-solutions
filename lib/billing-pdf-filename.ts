export function billingPdfFilename(reference: string) {
  return reference.replace(/[^a-zA-Z0-9_-]/g, "_") + ".pdf";
}
