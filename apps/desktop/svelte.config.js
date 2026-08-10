import adapter from "@sveltejs/adapter-static";
import { fileURLToPath } from "node:url";

const libPath = fileURLToPath(new URL("./src/lib", import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      fallback: "index.html",
    }),
    alias: {
      $lib: libPath,
      "$lib/*": `${libPath}/*`,
    },
  },
};

export default config;
