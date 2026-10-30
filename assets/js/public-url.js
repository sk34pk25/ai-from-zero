/** Les données et les guides suivent la version des scripts pour invalider un ancien cache. */
import { ASSET_VERSION } from "./version.js";
export function publicAssetUrl(path, base = document.baseURI) {
  const url = new URL(path, base);
  url.searchParams.set("v", ASSET_VERSION);
  return url;
}
