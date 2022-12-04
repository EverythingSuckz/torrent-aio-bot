const fs = require("fs");
const { google } = require("googleapis");
const logger = require("./logger");
// import { config } from "../config";
const config  = require("../config");

let parsedToken = null;
if (config.GDRIVE_TOKEN) {
  try {
    parsedToken = JSON.parse(config.GDRIVE_TOKEN);
  } catch (e) {
    logger("GDRIVE_TOKEN env not correct\nTOKEN set to:", config.GDRIVE_TOKEN);
  }
}

const SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly", "https://www.googleapis.com/auth/drive.file"];

if (!config.CLIENT_ID) {
  logger("CLIENT_ID env not set. Not uploading to gdrive.");
}
if (!config.CLIENT_SECRET) {
  logger("CLIENT_SECRET env not set. Not uploading to gdrive.");
}
if (!config.AUTH_CODE) {
  logger("AUTH_CODE env not set.");
}
if (!config.GDRIVE_TOKEN) {
  logger("GDRIVE_TOKEN env not set.");
}
if (config.GDRIVE_PARENT_FOLDER) {
  logger(`GDRIVE_PARENT_FOLDER set to ${config.GDRIVE_PARENT_FOLDER}`);
}

let auth = null;
let drive = null;

if (config.CLIENT_ID && config.CLIENT_SECRET) {
  authorize().then(a => {
    if (!a) return;
    auth = a;
    drive = google.drive({ version: "v3", auth });
    logger("Gdrive client up");
  });
}

async function authorize() {
  const oAuth2Client = new google.auth.OAuth2(config.CLIENT_ID, config.CLIENT_SECRET, `http://[::1]:${config.PORT}`);

  if (!config.AUTH_CODE) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES
    });
    logger(`Get AUTH_CODE env by visiting this url: \n${authUrl}\n`);
    return null;
  } else if (config.AUTH_CODE && !config.GDRIVE_TOKEN) {
    return oAuth2Client.getToken(config.AUTH_CODE, (err, token) => {
      if (err) {
        console.error("Error retrieving access token\n", err);
        return null;
      }
      oAuth2Client.setCredentials(token);
      if (!config.GDRIVE_TOKEN) logger("Set GDRIVE_TOKEN env to:\n", JSON.stringify(token));
      else logger("Gdrive config OK.");
      return oAuth2Client;
    });
  } else if (config.AUTH_CODE && config.GDRIVE_TOKEN) {
    oAuth2Client.setCredentials(parsedToken);
    return oAuth2Client;
  } else {
    logger("AUTH_CODE:", !!config.AUTH_CODE);
    logger("GDRIVE_TOKEN:", !!config.GDRIVE_TOKEN);
  }
}

function getAuthURL(CLIENT_ID, CLIENT_SECRET) {
  const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, `http://[::1]:${config.PORT}`);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES
  });
  return authUrl;
}

function getAuthToken(CLIENT_ID, CLIENT_SECRET, AUTH_CODE) {
  return new Promise((resolve, reject) => {
    const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, `http://[::1]:${config.PORT}`);
    oAuth2Client.getToken(AUTH_CODE, (err, token) => {
      err ? reject(err) : resolve(token);
    });
  });
}

function createFolder(name, parentId) {
  return new Promise((resolve, reject) => {
    var fileMetadata = {
      name, mimeType: "application/vnd.google-apps.folder" , parents: parentId ? [parentId] : null
    }; // prettier-ignore
    drive.files.create(
      { supportsTeamDrives: true, resource: fileMetadata, fields: "id" },
      (err, file) => (err ? reject(err) : resolve(file))
    ); // prettier-ignore
  });
}

function uploadFileStream(name, stream, parentId = config.GDRIVE_PARENT_FOLDER) {
  return new Promise((resolve, reject) => {
    var media = { body: stream };
    drive.files.create(
      { supportsTeamDrives: true, resource: { name, parents: parentId ? [parentId] : null }, media: media, fields: "id" },
      (err, file) => (err ? reject(err) : resolve(file))
    ); // prettier-ignore
  });
}

function uploadFile(name, path, parentId = config.GDRIVE_PARENT_FOLDER) {
  return new Promise((resolve, reject) => {
    var media = { body: fs.createReadStream(path) };
    drive.files.create(
      { supportsTeamDrives: true, resource: { name, parents: parentId ? [parentId] : null }, media: media, fields: "id" },
      (err, file) => (err ? reject(err) : resolve(file))
    ); // prettier-ignore
  });
}

async function uploadFolder(path, parentId) {
  const intr = path.split("/");
  const name = intr[intr.length - 1];

  try {
    const stat = fs.lstatSync(path);

    if (stat.isDirectory()) {
      // make a folder in gdrive
      const folder = await createFolder(name, parentId || config.GDRIVE_PARENT_FOLDER);
      const folderId = folder.data.id;

      // get list of folders contents
      const contents = fs.readdirSync(path, { withFileTypes: true });
      const uploads = contents.map(val => {
        const name = val.name;
        const isDir = val.isDirectory();
        const isFile = val.isFile();

        // if dir upload dir recursively
        // else file upload the file
        if (isDir) {
          return uploadFolder(`${path}/${name}`, folderId);
        } else if (isFile) {
          return uploadFile(name, `${path}/${name}`, folderId);
        } else {
          return null;
        }
      });

      // await all uploads
      await Promise.all(uploads);

      // return the gdrive link
      return `https://drive.google.com/drive/folders/${folderId}`;
    } else if (stat.isFile()) {
      // make a folder in gdrive
      const folder = await createFolder(name, parentId || config.GDRIVE_PARENT_FOLDER);
      const folderId = folder.data.id;

      // upload the file to drive
      await uploadFile(name, `${path}`, folderId);

      // return the gdrive link
      return `https://drive.google.com/drive/folders/${folderId}`;
    }
  } catch (e) {
    console.log("error", e.message);
    return null;
  }
}

async function uploadWithLog(path, parentId) {
  const intr = path.split("/");
  intr[intr.length - 1] = "gdrive.txt";
  const gdriveText = intr.join("/");
  fs.writeFileSync(gdriveText, "Upload started\n");
  const url = await uploadFolder(path, parentId);
  if (url) {
    fs.appendFileSync(gdriveText, `Gdrive url: ${url}`);
    return url;
  } else {
    fs.appendFileSync(gdriveText, `An error occured. GDRIVE_PARENT_FOLDER: ${config.GDRIVE_PARENT_FOLDER}`);
    return null;
  }
}

function getFiles(folderId) {
  let query;
  const parent = folderId ||config.GDRIVE_PARENT_FOLDER;
  if (parent) query = `'${parent}' in parents and trashed = false`;
  else query = "trashed = false";
  return new Promise((resolve, reject) => {
    drive.files.list(
      {
        q: query,
        pageSize: 1000,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: "nextPageToken, files(id, name, modifiedTime, iconLink, mimeType)"
      },
      (err, res) => (err ? reject(err) : resolve(res.data.files))
    );
  });
}

function sendFileStream(req, res) {
  const fileId = req.query.id || req.params.id;
  if (!fileId) res.sendStatus(404);
  drive.files.get(
    {
      fileId,
      alt: "media"
    },
    { responseType: "stream", ...req.headers },
    (err, resp) => {
      if (!err) {
        Object.keys(resp.headers).forEach(val => {
          res.setHeader(val, resp.headers[val]);
        });
        resp.data
          .on("end", () => {})
          .on("error", () => {})
          .pipe(res);
      } else {
        console.log("error ", err);
        res.end();
      }
    }
  );
}

module.exports = { uploadFolder, uploadFileStream, uploadFile, uploadWithLog, getFiles, sendFileStream, getAuthURL, getAuthToken };