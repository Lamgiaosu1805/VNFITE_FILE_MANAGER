const mysql = require("mysql2/promise");
const SftpClient = require("ssh2-sftp-client");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const FileSyncModel = require("../models/FileSyncModel");

async function syncFilesFromSource() {
  const mysqlConn = await mysql.createConnection({
    host: "42.113.122.119",
    user: "vnfite",
    password: process.env.passwordMYSQL,
    database: "VNF_FILE_MANAGEMENT",
  });

  const [rows] = await mysqlConn.execute(
    "SELECT id, name, path, type FROM VNF_FILE_MANAGEMENT.tbl_file_information WHERE is_deleted IS NULL"
  );

  const sftp = new SftpClient();
  await sftp.connect({
    host: "42.113.122.119",
    username: "root",
    password: process.env.passwordSFTP,
  });

  const saved = [];
  const skipped = [];
  const localBase = "/var/www/uploads/backup";

  for (const row of rows) {
    const filename = row.name;
    const remotePath = row.path;
    const mimetype = mime.lookup(filename) || "application/octet-stream";
    const type = mimetype.startsWith("image/") ? "image" : "document";

    const localDir = path.join(localBase, type === "image" ? "images" : "documents");
    const localPath = path.join(localDir, filename);
    const url = `/uploads/backup/${type === "image" ? "images" : "documents"}/${filename}`;

    try {
      const exists = await FileSyncModel.findOne({ idOLD: row.id });
      if (exists) {
        skipped.push(filename);
        continue;
      }

      if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

      await sftp.fastGet(remotePath, localPath);

      const doc = await FileSyncModel.create({
        fileName: filename,
        mimeType: mimetype,
        type,
        url,
        idOLD: row.id,
      });

      saved.push(doc);
    } catch (err) {
      console.error(`❌ Lỗi khi xử lý file ${filename}:`, err.message);
    }
  }

  await sftp.end();
  await mysqlConn.end();

  return { savedCount: saved.length, skippedCount: skipped.length };
}

module.exports = syncFilesFromSource;