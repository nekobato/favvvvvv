const maxHtmlBytes = 512 * 1024;
const maxImageBytes = 512 * 1024;
const maxFaviconBytes = 128 * 1024;
const maxRedirects = 3;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const imageHeaders = {
  "image/png": [137, 80, 78, 71, 13, 10, 26, 10],
  "image/jpeg": [255, 216, 255],
  "image/gif": [71, 73, 70, 56],
  "image/x-icon": [0, 0, 1, 0],
} as const;
const titleEntities = new Map([
  ["amp", "&"], ["apos", "'"], ["gt", ">"], ["lt", "<"], ["quot", '"'],
  ["nbsp", " "], ["ndash", "–"], ["mdash", "—"], ["hellip", "…"],
]);

type PreviewImage = { type: string; bytes: Uint8Array<ArrayBuffer> };

export type LinkPreview = {
  title: string | null;
  thumbnail: PreviewImage | null;
  favicon?: PreviewImage | null;
};

function decodeTitle(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (entity, reference: string) => {
    if (!reference.startsWith("#")) return titleEntities.get(reference.toLowerCase()) ?? entity;
    const hexadecimal = reference[1]?.toLowerCase() === "x";
    const codePoint = Number.parseInt(reference.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!codePoint || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return "\ufffd";
    return String.fromCodePoint(codePoint);
  });
}

function externalUrl(value: string, base?: URL) {
  if (value.length > 8192) return null;
  try {
    const url = new URL(value, base);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port
      || !host.includes(".") || host.startsWith("[") || /^[\d.]+$/.test(host)
      || /(?:^|\.)(?:localhost|local|internal|home\.arpa)$/.test(host)) {
      return null;
    }
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

async function fetchPublic(url: URL, accept: string, signal: AbortSignal) {
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await fetch(url, {
      headers: { Accept: accept },
      redirect: "manual",
      cache: "no-store",
      signal,
    });
    if (!redirectStatuses.has(response.status)) return { response, url };

    const location = response.headers.get("Location");
    await response.body?.cancel();
    const next = location && externalUrl(location, url);
    if (!next) return null;
    url = next;
  }
  return null;
}

async function readBytes(response: Response, limit: number) {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (reader && size < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, limit - size);
      chunks.push(chunk);
      size += chunk.byteLength;
    }
  } finally {
    await reader?.cancel();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function imageType(bytes: Uint8Array) {
  for (const [type, signature] of Object.entries(imageHeaders)) {
    if (signature.every((byte, i) => bytes[i] === byte)) return type;
  }
  if (bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70
    && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) return "image/webp";
  return null;
}

async function getImage(url: URL, signal: AbortSignal, limit = maxImageBytes) {
  try {
    const image = await fetchPublic(url, "image/*", signal);
    if (!image?.response.ok) {
      await image?.response.body?.cancel();
      return null;
    }
    const bytes = await readBytes(image.response, limit + 1);
    const type = bytes.byteLength <= limit ? imageType(bytes) : null;
    return type ? { type, bytes } : null;
  } catch {
    return null;
  }
}

async function readFavicon(icon: URL | null, pageUrl: URL, signal: AbortSignal) {
  const defaultIcon = new URL("/favicon.ico", pageUrl);
  if (icon && icon.href !== defaultIcon.href) {
    const image = await getImage(icon, signal, maxFaviconBytes);
    if (image) return image;
  }
  return getImage(defaultIcon, signal, maxFaviconBytes);
}

export async function readLinkPreview(value: string, includeThumbnail = true, includeFavicon = false): Promise<LinkPreview | null> {
  const url = externalUrl(value);
  if (!url) return null;
  const signal = AbortSignal.timeout(5000);

  try {
    const page = await fetchPublic(url, "text/html, application/xhtml+xml", signal);
    if (!page?.response.ok || !/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(
      page.response.headers.get("Content-Type") ?? "",
    )) {
      await page?.response.body?.cancel();
      return includeFavicon && page
        ? { title: null, thumbnail: null, favicon: await readFavicon(null, page.url, signal) }
        : null;
    }

    let title = "";
    let socialTitle = "";
    let openGraphImage = "";
    let twitterImage = "";
    let icon = "";
    let base = "";
    const html = await readBytes(page.response, maxHtmlBytes);
    const parsed = new HTMLRewriter()
      .on("title", { text(part) { title = (title + part.text).slice(0, 1024); } })
      .on("meta", {
        element(element) {
          const key = (element.getAttribute("property") ?? element.getAttribute("name"))?.toLowerCase();
          const value = (element.getAttribute("content") ?? "").trim();
          if (key === "og:title" && !socialTitle) socialTitle = value;
          if (key === "og:image" && !openGraphImage) openGraphImage = value;
          if (key === "twitter:image" && !twitterImage) twitterImage = value;
        },
      })
      .on("base[href]", { element(element) { base ||= element.getAttribute("href") ?? ""; } })
      .on("link[href]", {
        element(element) {
          if (element.getAttribute("rel")?.toLowerCase().split(/\s+/).includes("icon")) {
            icon ||= element.getAttribute("href") ?? "";
          }
        },
      })
      .transform(new Response(html, { headers: { "Content-Type": "text/html" } }));
    await parsed.arrayBuffer();

    const pageTitle = (decodeTitle(title).trim() || socialTitle).replace(/\s+/g, " ").slice(0, 240) || null;
    if (!includeThumbnail && !includeFavicon) return { title: pageTitle, thumbnail: null };

    const imageBase = externalUrl(base, page.url) ?? page.url;
    const image = [openGraphImage, twitterImage, includeFavicon ? "" : icon].filter(Boolean)
      .map((candidate) => externalUrl(candidate, imageBase)).find((candidate) => candidate !== null);
    const [thumbnail, favicon] = await Promise.all([
      includeThumbnail && image ? getImage(image, signal) : null,
      includeFavicon ? readFavicon(icon ? externalUrl(icon, imageBase) : null, page.url, signal) : undefined,
    ]);
    return includeFavicon ? { title: pageTitle, thumbnail, favicon } : { title: pageTitle, thumbnail };
  } catch {
    return null;
  }
}
