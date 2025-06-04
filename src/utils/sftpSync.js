const mysql = require("mysql2/promise");
const sftp = require("ssh2-sftp-client");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types"); // dùng mime-types
const FileSyncModel = require("../models/FileSyncModel");

const UPLOAD_DIR = "/var/www/uploads/backup";

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

        // Lấy phần mở rộng file (vd: .jpg)
        const ext = path.extname(fileName);

        // Xác định loại file dựa trên đuôi
        const isImage = ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(
          ext.slice(1).toLowerCase()
        );
        const type = isImage ? "image" : "document";
        const subFolder = isImage ? "images" : "documents";

        // Tạo tên file mới tránh trùng (ví dụ thêm timestamp)
        const uniqueName = `${Date.now()}_${fileName}`;

        const destPath = path.join(UPLOAD_DIR, subFolder, uniqueName);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });

        // Tải file từ sftp về thư mục đích
        await sftpClient.fastGet(filePathRemote, destPath);
        console.log(`⬇️  Downloaded ${fileName} as ${uniqueName}`);

        // Lấy mimeType chuẩn bằng mime-types
        const mimeType = mime.lookup(fileName) || "application/octet-stream";

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

    // KHÔNG gọi mongoose.disconnect() nếu đang dùng trong server

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