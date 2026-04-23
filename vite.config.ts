import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { apiServerPlugin } from "@lightfish/server/plugin";

function normalizeBase(raw: string | undefined): string {
  if (!raw || raw === "/") return "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

function defineAppConfig() {
  return {
    SERVER_API: "http://localhost:3000",
  };
}

/** 仅本地 dev（vite serve）时在 HTML 最前注入，先于应用脚本执行 */
function injectRouterAppConfigDev(): Plugin {
  return {
    name: "inject-router-app-config-dev",
    transformIndexHtml(html, ctx) {
      if (!ctx.server) {
        return html;
      }
      return html.replace(
        /<head(\s[^>]*)?>/i,
        `<head$1><script>window.__ROUTER_APP_CONFIG__=${JSON.stringify(
          defineAppConfig()
        )}</script>`
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: normalizeBase(process.env.VITE_BASE_URL),
  plugins: [
    apiServerPlugin(),
    injectRouterAppConfigDev(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
