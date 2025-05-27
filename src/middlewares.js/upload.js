const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Đường dẫn gốc để lưu file trên macOS
const BASE_UPLOAD_PATH = path.join(process.env.HOME, 'Desktop', 'uploads');

const createDirIfNotExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let subFolder = file.mimetype.startsWith('image/') ? 'images' : 'documents';
        const uploadPath = path.join(BASE_UPLOAD_PATH, subFolder);

        createDirIfNotExists(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname); // .jpg, .pdf...
        const baseName = path.basename(file.originalname, ext);
        const safeName = baseName
            .replace(/\s+/g, '-')         // khoảng trắng → dấu gạch ngang
            .replace(/[^a-zA-Z0-9-_]/g, '') // loại bỏ ký tự đặc biệt
            .toLowerCase();

        const finalName = `${Date.now()}-${safeName}${ext}`;
        cb(null, finalName);
    }
});

const upload = multer({ storage });

module.exports = upload.array('files');