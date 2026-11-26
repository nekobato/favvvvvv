import { readLinkPreview, type LinkPreview } from "../workers/metadata/preview";

export type LinkPreviewEnv = {
  FAVVVVVV_METADATA_MODE?: string;
  FAVPAGE_METADATA_MODE?: string;
  METADATA_FETCHER?: {
    readPreview(url: string, includeThumbnail?: boolean, includeFavicon?: boolean): Promise<LinkPreview | null>;
  };
};

export async function fetchLinkPreview(env: LinkPreviewEnv, url: string, includeThumbnail = true, includeFavicon = false) {
  const mode = env.FAVVVVVV_METADATA_MODE ?? env.FAVPAGE_METADATA_MODE;
  if (mode === "binding") return await env.METADATA_FETCHER?.readPreview(url, includeThumbnail, includeFavicon) ?? null;
  return !mode || mode === "direct" ? readLinkPreview(url, includeThumbnail, includeFavicon) : null;
}
