import fs from 'fs/promises';
import {
    lastBoibInfoFile,
    lastBoibInfo
} from '../modules/global.js';

export const wait = async (time: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), time);
  });
};

export const writeDataBase = async (): Promise<void> => {
  console.log('Escribiendo datos obtenidos en la base de datos');
  await fs.writeFile(lastBoibInfoFile, JSON.stringify(lastBoibInfo, null, 0));
  console.log('Datos guardados');
}
