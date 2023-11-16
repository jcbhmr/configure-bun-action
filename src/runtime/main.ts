import { main } from "./utils.ts";
import * as core from "@actions/core";

core.warning("bun0 is deprecated and will be removed. Please use bun1 instead. For more information, visit https://github.com/jcbhmr/configure-bun-action and https://bun.sh/blog/bun-v1.0");
await main("main");
