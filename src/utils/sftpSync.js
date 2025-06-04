// file: services/syncService.js
const mysql = require("mysql2/promise");
const sftp = require("ssh2-sftp-client");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const FileSyncModel = require("../models/FileSyncModel");

const MYSQL_CONFIG = {
  host: "42.113.122.119",
  port: 3306,
  user: "vnfite",
  password: "Vnfite20230712!@#",
  database: "VNF_FILE_MANAGEMENT",
};

const SSH_CONFIG = {
  host: "42.113.122.119",
  port: 22,
  username: "root",
  password: process.env.passwordMYSQL,
};

const UPLOAD_DIR = "/var/www/uploads/backup";

async function syncFiles() {
  const errorFiles = [];
  try {
    const connection = await mysql.createConnection(MYSQL_CONFIG);
    console.log("✅ Connected to MySQL");

    const [rows] = await connection.execute(
      `SELECT id, name, path, type FROM tbl_file_information WHERE is_deleted IS NULL`
    );

    const sftpClient = new sftp();
    await sftpClient.connect(SSH_CONFIG);

    for (const row of rows) {
      try {
        const filePathRemote = row.path;
        const fileName = row.name;
        const type = ["jpg", "png", "jpeg"].includes(row.type.toLowerCase())
          ? "image"
          : "document";
        const subFolder = type === "image" ? "images" : "documents";
        const destPath = path.join(UPLOAD_DIR, subFolder, fileName);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });

        await sftpClient.fastGet(filePathRemote, destPath);
        console.log(`⬇️  Downloaded ${fileName}`);

        const url = `/uploads/backup/${subFolder}/${fileName}`;
        const fileDoc = new FileSyncModel({
          fileName,
          mimeType: `application/${row.type}`,
          type,
          url,
          idOLD: row.id,
        });

        await fileDoc.save();
        console.log(`📥 Saved ${fileName} to MongoDB`);
      } catch (fileErr) {
        console.error(`❌ Error syncing file ${row.name}:`, fileErr.message);
        errorFiles.push({ id: row.id, name: row.name, error: fileErr.message });
      }
    }

    await sftpClient.end();
    await connection.end();
    await mongoose.disconnect();

    return {
      success: true,
      totalFiles: rows.length,
      failedFiles: errorFiles.length,
      errors: errorFiles,
    };
  } catch (err) {
    return {
      success: false,
      message: "Critical sync failure",
      error: err.message,
    };
  }
}

module.exports = { syncFiles };