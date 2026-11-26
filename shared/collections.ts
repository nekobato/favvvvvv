export const maxCollectionNameLength = 80;

export type SavedLink = {
  id: string;
  title: string;
  url: string;
  hasThumbnail: boolean;
  inDashboard: boolean;
  collectionIds: string[];
};

export type CollectionSummary = {
  id: string;
  name: string;
  total: number;
};
