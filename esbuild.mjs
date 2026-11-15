import builtins from "builtin-modules";
import { context } from "esbuild";

const watch = process.argv.includes("--watch");

const ctx = await context({
  entryPoints: ["src/main.ts"],
  outfile: "main.js",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "es2020",
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtins],
  logLevel: "info",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
