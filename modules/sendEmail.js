require('dotenv');
const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");

const tenantId = process.env.APP_TENANT_ID;
const clientId = process.env.APP_CLIENT_ID;
const clientSecret = process.env.APP_CLIENT_SECRET_VALUE;

// Set up authentication
const graphCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
const graphClient = Client.initWithMiddleware({
  authProvider: {
    getAccessToken: async () => {
      const token = await graphCredential.getToken("https://graph.microsoft.com/.default");
      return token.token;
    },
  },
});

//export variables
module.exports = {
    graphClient,
}
