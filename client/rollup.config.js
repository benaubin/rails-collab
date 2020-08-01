import typescript from "@wessberg/rollup-plugin-ts";

const external = [
  "prosemirror-state",
  "prosemirror-transform",
  "prosemirror-model",
  "lodash/throttle",
  "lodash/flatMap",
  "lodash/forEachRight",
];

export default [
  {
    input: ["./src/index.ts"],
    output: [{ dir: "dist", format: "cjs", entryFileNames: "[name].js" }],
    external,
    plugins: [typescript()],
  },
];
