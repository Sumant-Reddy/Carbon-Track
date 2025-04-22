const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary
 * @param {string} file - File path or base64 string
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload response
 */
const uploadFile = async (file, options = {}) => {
  try {
    const defaultOptions = {
      folder: 'carbontrack',
      resource_type: 'auto',
      ...options,
    };

    const result = await cloudinary.uploader.upload(file, defaultOptions);
    logger.info(`File uploaded to Cloudinary: ${result.public_id}`);
    return result;
  } catch (error) {
    logger.error('Cloudinary upload error:', error);
    throw error;
  }
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID of the file
 * @returns {Promise<Object>} Cloudinary deletion response
 */
const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info(`File deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    logger.error('Cloudinary deletion error:', error);
    throw error;
  }
};

/**
 * Generate a signed URL for a file
 * @param {string} publicId - Cloudinary public ID of the file
 * @param {Object} options - Transformation options
 * @returns {string} Signed URL
 */
const getSignedUrl = (publicId, options = {}) => {
  try {
    const defaultOptions = {
      secure: true,
      ...options,
    };

    return cloudinary.url(publicId, defaultOptions);
  } catch (error) {
    logger.error('Cloudinary signed URL generation error:', error);
    throw error;
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  getSignedUrl,
}; 