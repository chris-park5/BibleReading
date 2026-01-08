import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "supabase/**",
      "public/**",
      "utils/**",
      "scripts/**",
      "vite.config.ts",
      "vitest.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Prevent React 310 / hook order issues
      "react-hooks/rules-of-hooks": "error",
      // Useful but can be noisy; keep as warning
      "react-hooks/exhaustive-deps": "warn",

      // Keep lint low-friction: avoid introducing a large backlog
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
];
