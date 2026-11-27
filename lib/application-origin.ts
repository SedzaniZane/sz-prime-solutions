// Payment return URLs must never come from a caller-controlled Host header.
export function applicationOrigin() {
  const url = new URL(process.env.APP_URL || "https://sz-prime-solutions.vercel.app");
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Invalid application URL configuration");
  }
  return url.origin;
}
