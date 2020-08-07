import typescript from "@wessberg/rollup-plugin-ts";

const external = [];

export default [
  {
    input: ["./src/index.ts"],
    output: [
      { dir: "dist", format: "cjs", entryFileNames: "[name].js" },
      { dir: "dist", format: "es", entryFileNames: "[name].es.js" },
    ],
    external,
    plugins: [typescript()],
  },
];
