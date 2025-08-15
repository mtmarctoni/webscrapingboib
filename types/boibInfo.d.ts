export interface DocListItem {
  id: string;
  htmlLink: string;
  description: string;
  downloadPdfLink: string;
}

export interface SectionLink {
  id: number;
  titulo: string;
  link: string;
  docList: DocListItem[];
}

export interface BoibInfo {
  ultimoBoletin: string;
  isExtraordinary: boolean;
  idBoib: string;
  idAnualBoib: string;
  dateLastBoib: string;
  linkUltimoBoletin: string;
  customersMatched: string[];
  sectionLinks: SectionLink[];
  numMatches: number;
}
