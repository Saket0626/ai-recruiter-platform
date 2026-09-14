export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type FacultySearchQuery = {
  university: string;
  domain: string;
  keywords: string[];
  maxResults: number;
};

export interface SearchProvider {
  readonly name: string;
  searchFaculty(query: FacultySearchQuery): Promise<SearchResult[]>;
}
