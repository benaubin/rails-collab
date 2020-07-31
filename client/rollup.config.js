import typescript from "@wessberg/rollup-plugin-ts";

const external = [
  "prosemirror-state",
  "prosemirror-transform",
  "lodash/throttle",
];

export default [
  {
    input: ["./src/index.ts"],
    output: [{ dir: "dist", format: "cjs", entryFileNames: "[name].js" }],
    external,
    plugins: [typescript()],
  },
];
