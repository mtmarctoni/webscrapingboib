require('dotenv').config();
const nodemailer = require('nodemailer');

//Define constants
// The URL of the BOIB website or the specific page you want to scrape
const domainUrl = 'https://www.caib.es'
const url = domainUrl.concat('/eboibfront/ca');
//words to search in Boib descriptions
const wordsToSearch = [
    "FOTOPAR",
    "Energia i Canvi Climàtic",
    "Transcició Energètica i Canvi CLimàtic",
    "FEDER"
];

//customers to look for
const customers = [
    'GRIMALT ADROVER',
    'FLORES CAÑELLAS',
    'CLAR ORELL'
]

//email constants
const sendEmailBool = false;
const emailUser = process.env.OUTLOOK_USER
const emailPassword = process.env.OUTLOOK_PASSWORD
const emailBody = 
`Hola, este es un correo automático.

Adjunto estan los BOIBs encontrados según los siguientes criterios de búsqueda:

- ${wordsToSearch}

Que tengas un buend día.`
let transporter = nodemailer.createTransport({
    service: 'Outlook365',
    auth: {
        user: emailUser,
        pass: emailPassword
    }
});

//auxiliary constants
const months = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const lastBoibInfoFile = 'lastBoibInfo.json';
let lastBoibInfo = {};
let previousBoibInfo = {};
let downloadedPdfPaths = [];

//export variables
module.exports = {
    domainUrl,
    url,
    wordsToSearch,
    customers,
    sendEmailBool,
    emailUser,
    emailPassword,
    emailBody,
    transporter,
    months,
    lastBoibInfoFile,
    lastBoibInfo,
    previousBoibInfo,
    downloadedPdfPaths
}