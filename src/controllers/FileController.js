const FileUploadModel = require("../models/FileUploadModel");
const fs = require("fs");
const path = require("path");
const syncFilesFromSource = require("../utils/sftpSync");
const FileSyncModel = require("../models/FileSyncModel");
const mime = require('mime');

// Hàm xóa file vật lý
const deleteUploadedFiles = (files) => {
    for (const file of files) {
        fs.unlink(file.path, (err) => {
            if (err) console.error("Failed to delete file:", file.path);
        });
    }
};

const FileController = {
    uploadFile: async (req, res) => {
        const files = req.files;
        const mappingsRaw = req.body.mappings;

        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: "No files uploaded." });
        }

        if (!mappingsRaw) {
            // Nếu không có mappings thì xóa file và trả lỗi
            deleteUploadedFiles(files);
            return res.status(400).json({ success: false, message: "Missing required metadata mappings." });
        }

        let mappings = [];

        try {
            mappings = JSON.parse(mappingsRaw);

            if (!Array.isArray(mappings)) {
                throw new Error("Mappings must be an array.");
            }

            if (mappings.length !== files.length) {
                throw new Error("Number of metadata mappings does not match number of files.");
            }

            const savedFiles = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                if (
                    !file.mimetype.startsWith("image/") &&
                    !file.mimetype.startsWith("application/")
                ) {
                    throw new Error(`Unsupported file type: ${file.mimetype}`);
                }

                const type = file.mimetype.startsWith("image/") ? "image" : "document";
                const url = `/uploads/${type === "image" ? "images" : "documents"}/${file.filename}`;

                const metadata = mappings[i]; // Bắt buộc phải có

                const fileDoc = new FileUploadModel({
                    fileName: file.filename,
                    mimeType: file.mimetype,
                    type,
                    url,
                    ...metadata, // ví dụ: customerId, contractId
                });

                const saved = await fileDoc.save();

                savedFiles.push({
                    ...metadata,
                    fileId: saved._id,
                    fileName: saved.fileName,
                    mimeType: saved.mimeType,
                    type: saved.type,
                });
            }
            return res.json({ success: true, files: savedFiles });

        } catch (err) {
            console.error("Upload error:", err.message);

            deleteUploadedFiles(files);

            return res.status(400).json({
                success: false,
                message: "Upload failed. All files discarded.",
                error: err.message,
            });
        }
    },
    showFile: async (req, res) => {
        try {
            const {idFile} = req.params
            const file = await FileUploadModel.findById(idFile)
            const imagePath = path.join('/var/www', file.url);
            if (!fs.existsSync(imagePath)) {
                return res.status(404).send('Image not found');
            }
            res.sendFile(imagePath);
        } catch (error) {
            console.log(error)
            res.status(400).json({
                success: false,
                message: "Can't show this file",
                error: error.message,
            });
        }
    },
    syncFile: async (req, res) => {
        const result = await syncFilesFromSource.syncFiles();

        if (result.success) {
            res.json({
            message: "Sync completed",
            total: result.totalFiles,
            failed: result.failedFiles,
            errors: result.errors, // danh sách file lỗi chi tiết
            });
        } else {
            res.status(500).json({
            message: result.message || "Sync failed",
            error: result.error,
            });
        }
    },
    showFileSync: async (req, res) => {
        try {
            const {idFile} = req.params
            const file = await FileSyncModel.findOne({idOLD: idFile})
            const imagePath = path.join('/var/www', file.url);
            console.log(imagePath)
            if (!fs.existsSync(imagePath)) {
                return res.status(404).send('Image not found');
            }
            const mimeType = mime.getType(imagePath) || 'application/octet-stream';
            res.type(mimeType);
            res.sendFile(imagePath);
        } catch (error) {
            console.log(error)
            res.status(400).json({
                success: false,
                message: "Can't show this file",
                error: error.message,
            });
        }
    }
};

module.exports = FileController;