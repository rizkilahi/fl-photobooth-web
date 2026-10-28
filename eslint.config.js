import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "coverage/"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.browser } },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
    },
  },
  {
    files: ["tests/**/*.js", "eslint.config.js", "vitest.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
