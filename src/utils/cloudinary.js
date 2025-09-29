import dotenv from "dotenv";
dotenv.config({ path: './.env' });

import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key:process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloundinary = async (localFilePath)=>{
    try{
        if(!localFilePath) return null
        //upload file on clouding
        const normalizedPath = localFilePath.replace(/\\/g, "/");
        const response = await cloudinary.uploader.upload(normalizedPath,{
            resource_type:"auto"
        })
        //file has been uploaded successfull
        fs.unlinkSync(localFilePath)
        return response;
    }
    catch(error){
        //console.error("❌ Cloudinary upload error:", error);
        fs.unlinkSync(localFilePath)
        return null;
    }
}

export {uploadOnCloundinary}