import download from "download";
import path from "path";
import ora from "ora";
import fs from "fs/promises";

import { downloadedPdfPaths, lastBoibInfo } from "../modules/global.js";

export const downloadPdfs = async (links: string[]): Promise<void> => {
  const stringDate = lastBoibInfo.dateLastBoib;
  const date = new Date(stringDate);
  const folderName = `${lastBoibInfo.idAnualBoib}_${date.getDate()}-${
    date.getMonth() + 1
  }-${date.getFullYear()}`;
  const folderPath = path.resolve(process.cwd(), "BOIBpdfs", folderName) + "/";
  const spinner = ora(`Los pdfs se descargan en:\n${folderPath}`).start();
  for (let link of links) {
    await download(link, folderPath);
    spinner.text = `Descargado ${link}`;
  }
  spinner.succeed(`Descarga completada`);
  const downloadedPdfNames = await fs.readdir(folderPath);
  downloadedPdfNames.forEach((file: string) => {
    if (file.endsWith(".pdf")) {
      downloadedPdfPaths.push(`${folderPath}${file}`);
    }
  });
};
