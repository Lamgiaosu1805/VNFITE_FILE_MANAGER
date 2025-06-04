const express = require('express');
const FileController = require('../controllers/FileController');
const uploadMiddleware = require('../middlewares.js/upload');
const router = express.Router()

router.post('/upload', uploadMiddleware, FileController.uploadFile);
router.get('/file/:idFile', FileController.showFile);
router.post('/sync-files-from-source', FileController.syncFile);

module.exports = router;