require('dotenv').config();
const nodemailer = require('nodemailer');

//Define constants
// The URL of the BOIB website or the specific page you want to scrape
const domainUrl = 'https://www.caib.es'
const url = domainUrl.concat('/eboibfront/ca');
//words to search in Boib descriptions
const wordsToSearch = [
    process.env.WORDTOSEARCH_1,
    process.env.WORDTOSEARCH_2,
    process.env.WORDTOSEARCH_3,
    process.env.WORDTOSEARCH_4,
    process.env.WORDTOSEARCH_5,
    process.env.WORDTOSEARCH_6,
    process.env.WORDTOSEARCH_7,
    process.env.WORDTOSEARCH_8,
    process.env.WORDTOSEARCH_9
];

//customers to look for
const customers = [
    process.env.CUSTOMER_1,
    process.env.CUSTOMER_2,
    process.env.CUSTOMER_3,
    process.env.CUSTOMER_4,
    process.env.CUSTOMER_5,
    process.env.CUSTOMER_6,
    process.env.CUSTOMER_7
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