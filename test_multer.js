import multer from 'multer';
console.log("Memory Storage:", multer.memoryStorage());
console.log("Calling multer with no args:", multer());
const upload = multer({ storage: multer.memoryStorage() });
console.log("Upload storage:", upload.storage);
