import { fetch } from "void/client";
import {
  maxBookmarkTitleLength,
  maxBookmarkUrlLength,
  type BookmarkImportItem,
  type BookmarkImportResult,
} from "../shared/bookmarks";

export const maxBookmarkFileMegabytes = 50;

export async function readBookmarkFile(file: File) {
  if (file.size > maxBookmarkFileMegabytes * 1_000_000) {
    return { error: `${maxBookmarkFileMegabytes} MB 以下のファイルを選択してください。` };
  }

  let source: string;
  try {
    source = await file.text();
  } catch {
    return { error: "ファイルを読み込めませんでした。" };
  }

  // Template contents are inert. Only extracted text and URLs leave this fragment.
  const template = document.createElement("template");
  template.innerHTML = source;
  const links = template.content.querySelectorAll("dl dt > a[href]");
  const hasBookmarkHeader = /<!doctype\s+netscape-bookmark-file-1\s*>/i.test(source.slice(0, 1024));
  if (links.length === 0) {
    return {
      error: hasBookmarkHeader
        ? "ファイルにブックマークがありません。"
        : "ブラウザからエクスポートしたブックマーク HTML を選択してください。",
    };
  }

  const items: BookmarkImportItem[] = [];
  let skipped = 0;
  for (const link of links) {
    const url = link.getAttribute("href")?.trim() ?? "";
    if (!/^https?:/i.test(url) || url.length > maxBookmarkUrlLength) {
      skipped += 1;
      continue;
    }
    items.push({ url, title: (link.textContent ?? "").trim().slice(0, maxBookmarkTitleLength) });
  }

  return { items, skipped };
}

export function importBookmarkBatch(
  expectedUserId: string,
  items: BookmarkImportItem[],
): Promise<BookmarkImportResult> {
  return fetch("/api/bookmarks/import", {
    method: "POST",
    body: { expectedUserId, items },
    timeout: 30_000,
  });
}
