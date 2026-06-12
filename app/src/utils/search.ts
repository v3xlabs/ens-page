export type AppPagePath = "/" | "/names" | "/settings";

export const appPages: Array<{ label: string; path: AppPagePath; }> = [
  { label: "Home", path: "/" },
  { label: "My Names", path: "/names" },
  { label: "Settings", path: "/settings" },
];

export type SearchResult =
  | { label: string; name: string; type: "lookup" | "name"; }
  | { label: string; path: AppPagePath; type: "page"; };

export const buildSearchResults = (rawQuery: string, cachedNames: string[]): SearchResult[] => {
  const raw = rawQuery.trim();
  const query = raw.toLowerCase();

  if (!query) return [];

  const lookupName = raw.includes(".") ? raw : `${raw}.eth`;

  const results: SearchResult[] = [
    { label: `Go to ${lookupName}`, name: lookupName, type: "lookup" },
  ];

  for (const page of appPages) {
    if (page.label.toLowerCase().includes(query)) {
      results.push({ label: page.label, path: page.path, type: "page" });
    }
  }

  for (const name of cachedNames) {
    if (name.toLowerCase().includes(query) && name !== lookupName) {
      results.push({ label: name, name, type: "name" });
    }
  }

  return results;
};
