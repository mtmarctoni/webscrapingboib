import fs from "fs/promises";
import { lastBoibInfoFile, lastBoibInfo } from "../modules/global.js";

export const wait = async (time: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), time);
  });
};

export const writeDataBase = async (): Promise<void> => {
  console.log("Writing data to database");
  await fs.writeFile(lastBoibInfoFile, JSON.stringify(lastBoibInfo, null, 2));
  console.log("Data saved");
};