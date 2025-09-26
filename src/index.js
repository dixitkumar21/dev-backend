//require('dotenv').config({path: './env'}) // it is good it can run   but it not look good so for that

import dotenv from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({
    path:'./.env'
})

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000, ()=>{
        console.log('server is running');
    })
})
.catch((err)=>{
    console.log("mongodb connection failed!", err)
})



/*

//sometimes we use express here that it work or not
import express from "express"
const app = express()

;(async()=>{
    try{
        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        app.on("error", (error)=>{
            console.log("ERROR");
            throw error
        })

        app.listen(process.env.PORT,()=>{
            console.log("App is listing");
        })
    }
    catch(error){
        console.error("ERROR:", error)
        throw error
    }
})()
// this approach is good but we use second apprach
*/
