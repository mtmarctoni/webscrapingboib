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
    "FEDER",
    "NextGenerationEU",
    "NextGeneration",
    "NEXTG",
    "Pla de Recuperació, Transformació i Resiliència",
    "PITEIB"
];

//customers to look for
const customers = [
    'GRIMALT ADROVER',
    'FLORES CAÑELLAS',
    'CLAR ORELL',
    'MAS RÓDENAS', 'MAS RODENAS',
    'NNECKE', //Stefan Könnecke
    'GUASP RUBIO',
    'RODRIGUEZ LOBO',

]

//email constants
const sendEmailBool = true;
const emailUser = process.env.OUTLOOK_USER
const emailPassword = process.env.OUTLOOK_PASSWORD
const emailRecipients = [
    emailUser,
    process.env.OUTLOOK_RECIPIENT1
]
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
let numMatches = 0;

//export variables
module.exports = {
    domainUrl,
    url,
    wordsToSearch,
    customers,
    sendEmailBool,
    emailUser,
    emailPassword,
    emailRecipients,
    transporter,
    months,
    lastBoibInfoFile,
    lastBoibInfo,
    previousBoibInfo,
    downloadedPdfPaths,
    numMatches
}