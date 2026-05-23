import axios from "axios";
import path from "path";
import fs from "fs/promises";
import ora from "ora";

import { downloadedPdfPaths, lastBoibInfo } from "../modules/global.js";

const MAX_PDF_SIZE = 50 * 1024 * 1024;

function sanitizePathSegment(segment: string): string {
  return segment.replace(/\.\./g, "").replace(/[<>:"|?*]/g, "_").replace(/\0/g, "");
}

export const downloadPdfs = async (links: string[]): Promise<void> => {
  const stringDate = lastBoibInfo.dateLastBoib;
  const date = new Date(stringDate);
  const sanitizedId = sanitizePathSegment(lastBoibInfo.idAnualBoib);
  const folderName = `${sanitizedId}_${date.getDate()}-${
    date.getMonth() + 1
  }-${date.getFullYear()}`;
  const folderPath = path.resolve(process.cwd(), "BOIBpdfs", folderName) + "/";
  const spinner = ora(`Downloading PDFs to:\n${folderPath}`).start();
  await fs.mkdir(folderPath, { recursive: true });
  for (let link of links) {
    try {
      const response = await axios.get(link, {
        responseType: "arraybuffer",
        timeout: 30000,
        maxContentLength: MAX_PDF_SIZE,
        maxBodyLength: MAX_PDF_SIZE,
      });
      const fileName = sanitizePathSegment(link.split("/").pop() || `boib_${Date.now()}.pdf`);
      if (!fileName.endsWith(".pdf")) {
        continue;
      }
      const filePath = path.join(folderPath, fileName);
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(path.resolve(folderPath))) {
        spinner.warn(`Skipping potentially unsafe path: ${fileName}`);
        continue;
      }
      await fs.writeFile(filePath, response.data as Buffer);
      spinner.text = `Downloaded ${fileName}`;
    } catch (err) {
      spinner.warn(`Failed to download ${link}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  spinner.succeed("Download completed");
  const downloadedPdfNames = await fs.readdir(folderPath);
  for (const file of downloadedPdfNames) {
    if (file.endsWith(".pdf")) {
      downloadedPdfPaths.push(`${folderPath}${file}`);
    }
  }
};