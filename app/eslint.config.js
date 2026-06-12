import v3xlabs from "eslint-plugin-v3xlabs";

export default [
  ...v3xlabs.configs.recommended,
  {
    ignores: ["dist/**", "eslint.config.js", "node_modules/**"],
  },
];
