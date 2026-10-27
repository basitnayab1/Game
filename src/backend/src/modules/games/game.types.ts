export interface GameRecord {
  id: string;
  providerId: string;
  externalGameId: string;
  name: string;
  category: string;
  status: "active" | "inactive";
  artworkUrl?: string;
  isHot: boolean;
  isNew: boolean;
}

export interface GameSearchQuery {
  q?: string;
  category?: string;
  providerId?: string;
  favoritesOnly?: boolean;
}
