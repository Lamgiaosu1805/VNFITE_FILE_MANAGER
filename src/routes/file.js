const express = require('express');
const FileController = require('../controllers/FileController');
const uploadMiddleware = require('../middlewares.js/upload');
const router = express.Router()

router.post('/upload', uploadMiddleware, FileController.uploadFile);

module.exports = router;