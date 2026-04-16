import { fileURLToPath } from "url";
import { dirname } from "path";
import pkg from "@next/env";

const { loadEnvConfig } = pkg;

// Force-load .env.local from this file's directory, so the server works
// correctly regardless of what directory `npm run dev` is launched from.
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvConfig(__dirname);

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
