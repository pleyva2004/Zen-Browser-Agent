import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
    plugins: [react()],

    base: "./",
    root: ".",

    build: {
        // Output directory
        outDir: "dist",

        // Don't empty outDir (we have other extension files)
        emptyOutDir: false,

        rollupOptions: {
            input: {
                sidebar: resolve(__dirname, "sidebar.html"),
            },
            output: {
                // Predictable file names (no hashes)
                entryFileNames: "sidebar.js",
                chunkFileNames: "[name].js",
                assetFileNames: "[name].[ext]",
            },
        },

        // Required for extension CSP compliance
        cssCodeSplit: false,
        modulePreload: false,

        // Generate source maps for debugging
        sourcemap: true,
    },

    // Resolve path aliases
    resolve: {
        alias: {
            "@": resolve(__dirname, "src/sidebar"),
        },
    },
});
