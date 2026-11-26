import { WorkerEntrypoint } from "cloudflare:workers";
import { readLinkPreview } from "./preview";

export default class MetadataWorker extends WorkerEntrypoint {
  fetch() {
    return new Response(null, { status: 404 });
  }

  readPreview(url: string, includeThumbnail = true, includeFavicon = false) {
    return readLinkPreview(url, includeThumbnail, includeFavicon);
  }
}
