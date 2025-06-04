// file: services/syncService.js
const mysql = require("mysql2/promise");
const sftp = require("ssh2-sftp-client");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const mime = require("mime-types");  // dùng mime-types cho lookup
const FileSyncModel = require("../models/FileSyncModel");

const UPLOAD_DIR = "/var/www/uploads/backup";

function getRealExtension(filename) {
  const lastUnderscoreIndex = filename.lastIndexOf('_');
  let nameWithoutSuffix = filename;
  if (lastUnderscoreIndex !== -1) {
    nameWithoutSuffix = filename.substring(0, lastUnderscoreIndex);
  }
  return path.extname(nameWithoutSuffix);  // trả về ví dụ ".jpg"
}

async function syncFiles() {
  const MYSQL_CONFIG = {
    host: "42.113.122.119",
    port: 3306,
    user: "vnfite",
    password: process.env.passwordMYSQL,
    database: "VNF_FILE_MANAGEMENT",
  };

  const SSH_CONFIG = {
    host: "42.113.122.119",
    port: 22,
    username: "root",
    password: process.env.passwordSFTP,
  };

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

        // Lấy extension thật sự, ví dụ ".jpg"
        const realExt = getRealExtension(fileName);

        // Lấy tên gốc không có extension
        const baseName = path.basename(fileName, realExt);

        // Đổi tên file mới với timestamp và giữ đúng extension
        const uniqueName = `${Date.now()}_${baseName}${realExt}`;

        // Kiểm tra có phải file ảnh không
        const isImage = ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(
          realExt.slice(1).toLowerCase()
        );

        const type = isImage ? "image" : "document";
        const subFolder = isImage ? "images" : "documents";

        // Đường dẫn lưu file trên server
        const destPath = path.join(UPLOAD_DIR, subFolder, uniqueName);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });

        // Tải file từ SFTP về server
        await sftpClient.fastGet(filePathRemote, destPath);
        console.log(`⬇️  Downloaded ${fileName} as ${uniqueName}`);

        // Lấy mimeType chuẩn
        const mimeType = mime.lookup(realExt) || "application/octet-stream";

        // Lưu thông tin file vào MongoDB
        const fileDoc = new FileSyncModel({
          fileName: uniqueName,
          mimeType,
          type,
          url: `/uploads/backup/${subFolder}/${uniqueName}`,
          idOLD: row.id,
        });

        await fileDoc.save();
        console.log(`📥 Saved ${uniqueName} to MongoDB`);
      } catch (fileErr) {
        console.error(`❌ Error syncing file ${row.name}:`, fileErr.message);
        errorFiles.push({ id: row.id, name: row.name, error: fileErr.message });
      }
    }

    await sftpClient.end();
    await connection.end();
    // await mongoose.disconnect();

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
