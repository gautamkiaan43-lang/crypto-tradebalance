const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

// @desc    Get all active downloads
// @route   GET /api/user/downloads
// @access  Private
const getDownloads = async (req, res) => {
    try {
        const [downloads] = await pool.execute(
            'SELECT * FROM downloads WHERE status = "Active" ORDER BY created_at DESC'
        );
        res.json(downloads);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Upload a new document (Admin only)
// @route   POST /api/admin/downloads
// @access  Private/Admin
const uploadDownload = async (req, res) => {
    try {
        const { title, language, version } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a PDF file' });
        }

        const filePath = `/uploads/${req.file.filename}`;

        await pool.execute(
            'INSERT INTO downloads (title, language, version, file_path) VALUES (?, ?, ?, ?)',
            [title, language, version, filePath]
        );

        res.status(201).json({ message: 'Document uploaded successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a download (Admin only)
// @route   DELETE /api/admin/downloads/:id
// @access  Private/Admin
const deleteDownload = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [rows] = await pool.execute('SELECT file_path FROM downloads WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Document not found' });
        }

        // Delete file from disk if you want
        // const absolutePath = path.join(__dirname, '..', rows[0].file_path);
        // if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);

        await pool.execute('DELETE FROM downloads WHERE id = ?', [id]);
        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getDownloads,
    uploadDownload,
    deleteDownload
};
