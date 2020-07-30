import typescript from "@wessberg/rollup-plugin-ts";

const external = [
  "prosemirror-state",
  "uuid",
  "prosemirror-collab",
  "prosemirror-transform",
  "tslib",
  "lodash/throttle",
];

export default [
  {
    input: ["./src/index.ts"],
    output: [
      { dir: "dist", format: "es", entryFileNames: "[name].mjs" },
      { dir: "dist", format: "cjs", entryFileNames: "[name].js" },
    ],
    external,
    plugins: [typescript()],
  },
];
