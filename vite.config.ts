import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Safely import componentTagger if it exists
let componentTagger: (() => any) | undefined;
try {
  // This will only succeed if lovable-tagger exists
  // If not, TS will not complain because of the optional chaining
  componentTagger = require("./lovable-tagger")?.componentTagger;
} catch (e) {
  componentTagger = undefined;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base:'/mini-project/',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger?.()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
