const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api";
const API_BASE = RAW_BASE.replace(/\/api\/?$/, ""); // http://localhost:8080

export function getImageUrl(src?: string | { url?: string }): string {
  const path = typeof src === "string" ? src : src?.url;
  if (!path) return "https://via.placeholder.com/600x400?text=No+Image";

  if (path.startsWith("/")) {
    return `${API_BASE}${path}`;
  }
  return path;
}