import axios, { AxiosResponse } from "axios";
import https from "https";
import fs from "fs/promises";
import sfs from "fs";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio";
import {
  domainUrl,
  url,
  months,
  lastBoibInfo,
  previousBoibInfo,
} from "../modules/global.js";

export const resetInfo = (): any => ({
  ultimoBoletin: "",
  isExtraordinary: false,
  idBoib: 0,
  idAnualBoib: 0,
  dateLastBoib: "",
  linkUltimoBoletin: "",
  customersMatched: [],
  sectionLinks: [],
});

export const readDataBase = async (lastBoibInfoFile: string): Promise<void> => {
  if (!sfs.existsSync(lastBoibInfoFile)) {
    console.log("Archivo json no existe. Creando uno nuevo...");
    Object.assign(lastBoibInfo, resetInfo());
    await fs.writeFile(lastBoibInfoFile, JSON.stringify(lastBoibInfo), "utf8");
    console.log(`Archivo ${lastBoibInfoFile} creado.`);
  } else {
    const res = await fs.readFile(lastBoibInfoFile, "utf8");
    if (!res) {
      console.log("Archivo json vacío.");
      Object.assign(lastBoibInfo, resetInfo());
    } else {
      const data = JSON.parse(res);
      Object.assign(previousBoibInfo, data);
      Object.assign(lastBoibInfo, resetInfo());
      console.log("Datos obtenidos de la base de datos");
    }
  }
};

export const getLastBoib = async (): Promise<void> => {
  console.log("Cogiendo información del último BOIB");
  const maxRetries = 3;
  let attempt = 0;
  let success = false;
  let res: AxiosResponse<any, any>;
  while (attempt < maxRetries && !success) {
    try {
      res = await axios.get(url, { timeout: 10000 });
      success = true;
    } catch (err: any) {
      attempt++;
      if (attempt < maxRetries) {
        console.warn(`Intento ${attempt} fallido. Reintentando...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.error(
          "No se pudo obtener el último BOIB tras varios intentos."
        );
        if (
          err.code === "ECONNRESET" ||
          err.code === "ETIMEDOUT" ||
          err.code === "ENOTFOUND"
        ) {
          console.error(
            `Error de red: ${err.code}. Puede que el servidor esté caído o haya problemas de conexión.`
          );
        } else {
          console.error("Error desconocido:", err.message);
        }
        console.log("Saliendo...");
        process.exit(1);
      }
    }
  }
  const $ = cheerio.load(res.data) as CheerioAPI;
  const ultimoBoletin = $("div.ultimoBoletin div.caja.whitebg p a")
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const subLinkUltimoBoletin = $("div.ultimoBoletin div.caja.whitebg p a").attr(
    "href"
  );
  const anoUltimoBoletin = ultimoBoletin.match(/(\d{4})$/)?.[0] || "";
  const idUltimoBoletin =
    subLinkUltimoBoletin?.split("/")?.reverse()?.[1] || "";
  const wordsLastBoib = ultimoBoletin.split(" ");
  const idAnualBoib = wordsLastBoib[6];
  let monthNumber: string | number = months.indexOf(wordsLastBoib[9]) + 1;
  monthNumber = monthNumber < 10 ? "0" + monthNumber : monthNumber;
  const stringDatelastBoib =
    wordsLastBoib[11] + "-" + monthNumber + "-" + wordsLastBoib[7];
  const dateLastBoib = String(new Date(stringDatelastBoib));
  lastBoibInfo.ultimoBoletin = ultimoBoletin;
  lastBoibInfo.idBoib = idUltimoBoletin;
  lastBoibInfo.idAnualBoib = idAnualBoib;
  lastBoibInfo.dateLastBoib = dateLastBoib;
  lastBoibInfo.linkUltimoBoletin = `${url}/${anoUltimoBoletin}/${idUltimoBoletin}`;
};

export const getSectionLinks = async (link: string): Promise<void> => {
  try {
    const response = await axios.get(link);
    const html = response.data;
    const $ = cheerio.load(html) as CheerioAPI;
    lastBoibInfo.isExtraordinary = $("a.fijo p")
      .last()
      .text()
      .includes("Extraordinari");
    lastBoibInfo.isExtraordinary
      ? console.log("BOIB Extraordinari")
      : console.log("BOIB ordinari");
    const $sectionMenuHtml = cheerio.load(
      $(".primerosHijos").prop("outerHTML")
    ) as CheerioAPI;
    $sectionMenuHtml("li").each((i: number, elem: any) => {
      let link_1 = domainUrl.concat(
        $sectionMenuHtml(elem).find("a").attr("href")
      );
      let sectionObject: any = {
        id: i,
        titulo: link_1.split("/").reverse()[1].replace(/-/g, " "),
        link: link_1,
        docList: [],
      };
      lastBoibInfo.sectionLinks.push(sectionObject);
    });
  } catch (message_1: any) {
    return console.error(message_1);
  }
};

export const getDocLists = async (sectionLink: string): Promise<void> => {
  let sectionObject = lastBoibInfo.sectionLinks.filter(
    (obj: any) => obj.link === sectionLink
  )[0];
  if (!sectionObject) {
    console.error("No se encontro la sección");
    return;
  }
  const requestOptions = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    },
    timeout: 10000,
    httpsAgent: new https.Agent({ keepAlive: true }),
  };
  const response = await axios.get(sectionLink, requestOptions);
  const html = response.data;
  const $ = cheerio.load(html) as CheerioAPI;
  const llistatElement = $(".llistat");
  if (llistatElement.length) {
    const $docList = cheerio.load(
      llistatElement.prop("outerHTML")
    ) as CheerioAPI;
    $docList("ul.resolucions").each((j: number, elems: any) => {
      let docListObject: any = {
        id: "",
        htmlLink: "",
        description: "",
        downloadPdfLink: "",
      };
      $docList(elems)
        .find("a")
        .each((i: number, elem: any) => {
          let link = $docList(elem).attr("href");
          if (link.startsWith("/eboibfront/pdf/")) {
            let description = $docList(elem)
              .parents("ul.resolucions")
              .first()
              .find("p")
              .first()
              .text();
            let idText = $docList(elem)
              .parents("ul.resolucions")
              .first()
              .find("p.registre")
              .first()
              .text()
              .trim();
            let id = idText.split("-")[0].split(" ").reverse()[1];
            docListObject.downloadPdfLink = domainUrl + link;
            docListObject.description = description;
            docListObject.id = id;
          } else if (!link.endsWith("xml") && !link.endsWith("rdf")) {
            docListObject.htmlLink = link;
          } else {
            lastBoibInfo.sectionLinks[sectionObject.id].docList.push(
              docListObject
            );
          }
        });
    });
  } else {
    console.log(
      "No se ha encontrado el elemento con la clase 'llistat'. en " +
        sectionLink
    );
  }
};

export const getSpecificBoib = (wordsToSearch: string[]): any[] => {
  console.log(`\nBuscando documentos que contengan:\n${wordsToSearch}\n`);
  let filteredList = lastBoibInfo.sectionLinks.flatMap((section: any) => {
    return section.docList.filter((doc: any) => {
      return wordsToSearch.some((word: string) =>
        doc.description.includes(word)
      );
    });
  });
  if (filteredList.length == 0) {
    console.log("No hay documentos con estos criterios de búsqueda\n");
    return [];
  } else {
    console.log(`${filteredList.length} BOIBs encontrados`);
    return filteredList;
  }
};
