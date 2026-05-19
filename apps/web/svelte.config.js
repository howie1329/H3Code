import adapter from "@sveltejs/adapter-auto";
import { fileURLToPath } from "node:url";

const libPath = fileURLToPath(new URL("./src/lib", import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      $lib: libPath,
      "$lib/*": `${libPath}/*`,
    },
  },
};

export default config;
