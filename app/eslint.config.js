import v3xlabs from "eslint-plugin-v3xlabs";

export default [
  ...v3xlabs.configs.recommended,
  {
    ignores: [".tanstack/**", "dist/**", "eslint.config.js", "node_modules/**", "src/routeTree.gen.ts"],
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        URL: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
      },
    },
  },
];
