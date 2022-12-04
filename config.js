require('dotenv').config()
// import { cleanEnv, str, num } from "envalid";
const { cleanEnv, str, num  } = require("envalid")

const config = cleanEnv(process.env, {
    BOT_TOKEN: str(),
    HOST: str({default: "http://localhost"}),
    PORT: num({default: 8080}),
    CUSTOM_DOMAIN: str({default: ""}),

    CLIENT_ID: str({default: ""}),
    CLIENT_SECRET: str({default: ""}),
    AUTH_CODE: str({default: ""}),
    GDRIVE_TOKEN: str({default: ""}),
    GDRIVE_PARENT_FOLDER: str({default: ""}),

    PIRATEBAY_SITE: str({default: "https://thepiratebay.org/search/{term}"}),
    LIMETORRENT_SITE: str({default: "https://limetorrents.at/search?search={term}"}),
    O337X_SITE: str({default: "https://www.1337x.am/search/{term}/1/"}),
});

  module.exports = config;