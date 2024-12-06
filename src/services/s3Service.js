const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Load environment variables
const S3_BUCKET = process.env.AWS_BUCKET_NAME;
const REGION = process.env.AWS_REGION;

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: REGION,
});

const s3 = new AWS.S3();

const uploadFileToS3 = async (filePath, fileName, mimeType) => {
  try {
    const fileContent = fs.readFileSync(filePath);
    const params = {
      Bucket: S3_BUCKET,
      Key: `uploads/${fileName}`, // File will be stored in an 'uploads/' folder in S3
      Body: fileContent,
      ContentType: mimeType,
    };

    const response = await s3.upload(params).promise();
    return response.Location; // S3 file URL
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('Failed to upload file to S3.');
  }
};

module.exports = { uploadFileToS3 };
