export const shareFlowPath = "/flow?share=1";
export const shareLoginPath = "/login?share=1";

const sharedUrlParam = "shared-url";

// The fragment carries the draft through login without including it in page requests.
export function shareFragment(url: string) {
  return `#${new URLSearchParams({ [sharedUrlParam]: url })}`;
}

export function readShareFragment(hash: string) {
  return new URLSearchParams(hash.slice(1)).get(sharedUrlParam);
}
