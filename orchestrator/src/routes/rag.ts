import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/auth';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();
const upload = multer({ 
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  storage: multer.memoryStorage()
});

// POST /rag/upload
router.post('/upload', verifyToken, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No file uploaded' } });
    }

    const { buffer, originalname } = req.file;
    const ragServiceUrl = config.ragServiceUrl || 'http://127.0.0.1:8000';
    
    // Create native FormData and append the file buffer as a Blob
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: req.file.mimetype || 'application/pdf' });
    formData.append('file', blob, originalname);

    try {
      const response = await fetch(`${ragServiceUrl}/upload`, {
        method: 'POST',
        body: formData,
        // Native fetch will automatically set the correct Content-Type with boundary for FormData
      });

      if (!response.ok) {
        let errorText = await response.text();
        logger.error('RAG service upload failed', { status: response.status, errorText });
        return res.status(response.status).json({ error: { message: `RAG service error: ${response.status}` } });
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      logger.error('Failed to connect to RAG service', { error: err });
      return res.status(502).json({ error: { message: 'Failed to connect to RAG service' } });
    }
  } catch (error) {
    logger.error('RAG upload route error:', { error });
    next(error);
  }
});

export default router;
