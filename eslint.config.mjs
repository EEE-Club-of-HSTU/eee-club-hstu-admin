import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  ...next,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "@next/next/no-img-element": "off",
    },
  },
]);
