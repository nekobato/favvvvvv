import { z } from "zod";
import { maxBookmarkTitleLength, maxBookmarkUrlLength } from "../shared/bookmarks";
import { fetchLinkPreview, type LinkPreviewEnv } from "./link-preview";

export const bookmarkUrl = z.string().trim().max(maxBookmarkUrlLength).pipe(
  z.url({
    protocol: /^https?$/,
    normalize: true,
    abort: true,
    message: "HTTP または HTTPS の URL を入力してください。",
  })
    .max(maxBookmarkUrlLength, "URL が長すぎます。")
    .refine((value) => {
      const url = new URL(value);
      return !url.username && !url.password;
    }, "認証情報を含まない URL を入力してください。"),
);

export function bookmarkTitle(title: string, url: string) {
  return title.trim() || new URL(url).hostname.slice(0, maxBookmarkTitleLength);
}

export async function fetchBookmarkTitle(env: LinkPreviewEnv, url: string) {
  const preview = await fetchLinkPreview(env, url, false).catch(() => null);
  return typeof preview?.title === "string" ? preview.title.trim().slice(0, maxBookmarkTitleLength) || null : null;
}
