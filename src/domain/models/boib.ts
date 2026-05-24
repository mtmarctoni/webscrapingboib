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

export interface BoibState {
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

export interface ScrapeResult {
  success: boolean;
  state: BoibState;
  downloadedPdfPaths: string[];
  numMatches: number;
  emailSent: boolean;
}

export function createEmptyBoibState(): BoibState {
  return {
    ultimoBoletin: "",
    isExtraordinary: false,
    idBoib: "",
    idAnualBoib: "",
    dateLastBoib: "",
    linkUltimoBoletin: "",
    customersMatched: [],
    sectionLinks: [],
    numMatches: 0,
  };
}
