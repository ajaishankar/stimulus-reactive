import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";

export default [
  {
    input: "src/index.ts",
    output: [
      {
        name: "Stimulus Reactive",
        file: "dist/index.umd.js",
        format: "umd",
      },
      {
        file: "dist/index.js",
        format: "es",
      },
    ],
    context: "window",
    plugins: [
      replace({
        preventAssignment: true,
        values: {
          "process.env.NODE_ENV": JSON.stringify("production"),
        },
      }),
      resolve(),
      typescript(),
    ],
  },
];
