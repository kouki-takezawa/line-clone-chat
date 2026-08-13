import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "プライベートチャット",
    short_name: "トーク",
    description: "24時間で自動削除されるプライベートチャット",
    start_url: "/chat",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#06C755",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
