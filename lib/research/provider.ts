export type RetrievedPage = {
  url: string;
  title: string | null;
  text: string;
  html: string;
};

export interface ProfessorResearchProvider {
  retrieve(urls: string[]): Promise<RetrievedPage[]>;
}
