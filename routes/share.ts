import { defineHandler } from "void";
import { bookmarkUrl } from "../server/bookmark-input";
import { maxBookmarkUrlLength } from "../shared/bookmarks";
import { shareFlowPath, shareFragment } from "../shared/share";

function parseWebUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return;
  const result = bookmarkUrl.safeParse(value);
  if (result.success) return result.data;
}

function readSharedUrl(url = "", text = "") {
  const explicitUrl = parseWebUrl(url.trim());
  if (explicitUrl) return explicitUrl;

  const sharedText = text.trim();
  if (!/\s/.test(sharedText)) {
    const textUrl = parseWebUrl(sharedText);
    if (textUrl) return textUrl;
  }

  for (const match of sharedText.matchAll(/https?:\/\/[^\s<>"「」『』]+/gi)) {
    let candidate = match[0].replace(/[、。！？]+$/, "");
    if (sharedText[match.index - 1] === "(" && candidate.endsWith(")")) {
      candidate = candidate.slice(0, -1);
    }
    const textUrl = parseWebUrl(candidate);
    if (textUrl) return textUrl;
  }
  return "";
}

export const GET = defineHandler((c) => {
  const url = readSharedUrl(c.req.query("url"), c.req.query("text")?.slice(0, 2 * maxBookmarkUrlLength));
  c.header("Cache-Control", "no-store");
  return c.redirect(`${shareFlowPath}${shareFragment(url)}`, 303);
});
