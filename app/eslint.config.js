import v3xlabs from "eslint-plugin-v3xlabs";

export default [
  ...v3xlabs.configs.recommended,
  {
    ignores: [".tanstack/**", "dist/**", "eslint.config.js", "node_modules/**", "src/routeTree.gen.ts"],
  },
];
