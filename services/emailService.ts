import {
  emailUser,
  emailRecipients,
  downloadedPdfPaths,
  numMatches,
  lastBoibInfo,
  wordsToSearch,
  customers,
  transporter,
} from "../modules/global.js";

interface Attachment {
  filename: string | undefined;
  path: string;
}

interface MailOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: Attachment[];
}

export const sendEmailWithAttachments = async (): Promise<void> => {
  let emailBody = `\n
    Hola, este es un correo automático.\n
    `;
  if (downloadedPdfPaths.length === 0) {
    emailBody = emailBody.concat(`\n\n
        No se han encontrado BOIBs según los criterios de búsqueda siguientes:\n\n
        - ${wordsToSearch}\n\n        `);
  } else {
    emailBody = emailBody.concat(`\n
        Adjunto están los ${downloadedPdfPaths.length} BOIBs que se han encontrado según los siguientes criterios de búsqueda siguientes:
        \n\n
            - ${wordsToSearch}
        \n\n
        `);
    if (numMatches === 0) {
      emailBody = emailBody.concat(`\n
        De estos BOIBs no se ha podido encontrar ninguna coincidencia con los nombres de los clientes proporcionados:
        \n\n
        - ${customers}
        \n\n            `);
    } else {
      emailBody = emailBody.concat(`\n
        ¡¡¡OJO!!! Se han encontrado ${numMatches} coincidencias con los nombres de los clientes proporcionados:
        \n\n
        - ${customers}
        \n\n
        `);
    }
  }
  emailBody = emailBody.concat(`\n
    Que tengas un buend día.\n\n
    Marc de DocsEE\n
    Documentación Eficiente y Eficaz\n
    `);
  const attachments: Attachment[] = downloadedPdfPaths.map((path: string) => ({
    filename: path.split("/").pop(),
    path,
  }));
  const mailOptions: MailOptions = {
    from: emailUser,
    to: emailRecipients.join(", "),
    subject: `[NUEVO BOIB] ${lastBoibInfo.ultimoBoletin}`,
    text: emailBody,
    attachments,
  };
  console.log(`Enviando email a ${emailRecipients.join(", ")}`);
  await transporter.sendMail(mailOptions);
};
