import type { MetadataRoute } from "next";

/**
 * Lets the doctor add the dashboard to a phone's home screen and open it
 * full-screen like an app. No custom icons yet; the browser falls back to
 * the favicon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clinic Management — Dr. Khaled Nur Zihad",
    short_name: "Clinic",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#0f766e",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
