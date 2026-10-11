import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: '/5244', // 👈 Thay bằng đúng URL của C# Swagger nhé
                changeOrigin: true,
                secure: false,
            }
        }
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
})