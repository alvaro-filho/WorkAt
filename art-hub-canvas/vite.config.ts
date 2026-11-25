import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Backend Spring Boot. Em desenvolvimento o Vite repassa /api para o localhost:8080;
// em produção (Vercel) defina a variável API_URL com o endereço público do backend
// e o servidor do frontend repassa /api para lá (sem CORS, sem mudar o código).
const DEV_API = "http://localhost:8080";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = (process.env["API_URL"] ?? env["API_URL"] ?? "").replace(/\/+$/, "");

  return {
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // src/server.ts envolve o servidor do TanStack Start com a página de erro amigável.
        server: { entry: "server" },
        // Código em pastas server/ ou que importa "server-only" nunca vai para o navegador.
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // Só no build: o preset é escolhido pelo ambiente (Vercel no Vercel, Node no computador).
      ...(command === "build"
        ? [
            nitro({
              routeRules: apiUrl ? { "/api/**": { proxy: `${apiUrl}/api/**` } } : {},
            }),
          ]
        : []),
      viteReact(),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "::",
      port: 8081,
      proxy: {
        "/api": { target: DEV_API, changeOrigin: true },
      },
    },
  };
});
