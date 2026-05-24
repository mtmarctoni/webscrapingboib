/**
 * A single document entry within a BOIB section listing.
 */
export interface DocListItem {
  id: string;
  htmlLink: string;
  description: string;
  downloadPdfLink: string;
}

/**
 * A navigation section link within the BOIB bulletin menu.
 */
export interface SectionLink {
  id: number;
  titulo: string;
  link: string;
  docList: DocListItem[];
}

/**
 * Represents the full state of a BOIB scrape operation, including bulletin
 * metadata, matched customers, and section contents.
 */
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

/**
 * Outcome of a complete BOIB scrape run, including downloaded PDFs and
 * whether an email was sent.
 */
export interface ScrapeResult {
  success: boolean;
  state: BoibState;
  downloadedPdfPaths: string[];
  numMatches: number;
  emailSent: boolean;
}

/**
 * Creates a new BoibState with all fields initialised to empty defaults.
 * @returns A fresh, empty BoibState
 */
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
