import dotenv from 'dotenv';
import nodemailer, {type Transporter} from 'nodemailer';
dotenv.config();

const domainUrl: string = 'https://www.caib.es';
const url: string = domainUrl.concat('/eboibfront/ca');
const wordsToSearch: string[] = [
    process.env.WORDTOSEARCH_1,
    process.env.WORDTOSEARCH_2,
    process.env.WORDTOSEARCH_3,
    process.env.WORDTOSEARCH_4,
    process.env.WORDTOSEARCH_5,
    process.env.WORDTOSEARCH_6,
    process.env.WORDTOSEARCH_7,
    process.env.WORDTOSEARCH_8,
    process.env.WORDTOSEARCH_9
].filter(Boolean) as string[];

const customers: string[] = [
    process.env.CUSTOMER_1,
    process.env.CUSTOMER_2,
    process.env.CUSTOMER_3,
    process.env.CUSTOMER_4,
    process.env.CUSTOMER_5,
    process.env.CUSTOMER_6,
    process.env.CUSTOMER_7
].filter(Boolean) as string[];

const sendEmailBool: boolean = true;
const emailUser: string = process.env.ZOHO_USER || '';
const emailPassword: string = process.env.ZOHO_PASSWORD || '';
const emailRecipients: string[] = [
    process.env.RECIPIENT1 || '',
    process.env.RECIPIENT2 || '',
    process.env.RECIPIENT3 || ''
].filter(Boolean) as string[];
let transporter: Transporter = nodemailer.createTransport({
    host: 'smtp.zoho.eu', // or smtp.zoho.com for US
    port: 465,
    secure: true, // true for 465, false for 587
    auth: {
        user: emailUser,
        pass: emailPassword
    }
});

const months: string[] = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const lastBoibInfoFile: string = 'lastBoibInfo.json';
let lastBoibInfo: any = {};
let previousBoibInfo: any = {};
let downloadedPdfPaths: string[] = [];
let numMatches: number = 0;

export {
    domainUrl,
    url,
    wordsToSearch,
    customers,
    sendEmailBool,
    emailUser,
    emailPassword,
    emailRecipients,
    months,
    lastBoibInfoFile,
    transporter,
    lastBoibInfo,
    previousBoibInfo,
    downloadedPdfPaths,
    numMatches
};
