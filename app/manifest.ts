import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cal Grimes | Solution Architect",
    short_name: "Cal Grimes",
    description:
      "Cal Grimes - Solution Architect working at the intersection of AI, data, and scalable software systems.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: "/favicon.ico",
        sizes: "64x64",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: [
      "portfolio",
      "ai",
      "software engineering",
      "data engineering",
      "machine learning",
      "developer",
      "cloud architecture",
    ],
    lang: "en",
    dir: "ltr",
    scope: "/",
  };
}
