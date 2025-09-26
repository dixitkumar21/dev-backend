import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async ()=>{
    try{
        const connectionInstance= await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
        console.log("connected")
    }
    catch(error){
        console.error("mongo0db connection failed:", error)
        process.exit(1) // this process is just a reference of curr process provide by node and this 1 is code it can be anything like 0,etc
    }
}

export default connectDB