import path from "node:path";

/** Sanitises a path segment by removing dangerous characters and directory traversal. */
export function sanitizePathSegment(segment: string): string {
  return segment.replace(/[<>:"|?*]/g, "_").replace(/\0/g, "");
}

/** Builds a download folder path from bulletin identifiers and a date string. */
export function buildDownloadFolderName(
  idAnualBoib: string,
  dateLastBoib: string,
  pdfDownloadFolder: string,
): string {
  const sanitizedId = sanitizePathSegment(idAnualBoib);
  const date = new Date(dateLastBoib);
  const folderName = `${sanitizedId}_${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
  return path.resolve(process.cwd(), pdfDownloadFolder, folderName);
}

/** Resolves a file path within a folder, rejecting traversal and non-PDF names. */
export function resolveSafePath(folderPath: string, fileName: string): string | null {
  const safeName = sanitizePathSegment(fileName);
  if (!safeName.endsWith(".pdf")) {
    return null;
  }
  const filePath = path.join(folderPath, safeName);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(folderPath))) {
    return null;
  }
  return resolved;
}
