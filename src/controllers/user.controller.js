import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloundinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


const registerUser =asyncHandler( async(req,res)=>{
    //get user details from frontened
    //validatation-not empty
    //check if  user alrdy exist - email, username
    //check for images, check for avtar
    //upload them to cloudinary ,avatar
    //create userobject- create entry in db
    // remove password and refresh token firld from response
    //check for user creation
    //return res

    const {username,fullname,password,email}=req.body
    console.log("email:", email);

   /* if (fullname ===""){
        throw new ApiError(400,"full name is required")  it is good but for beg
    }*/
   if(
    [fullname,email,username,password].some((field)=>(
        field?.trim()===""
    ))
   ){
    throw new ApiError(400,"all fields are required")
   }

   const existedUser = await User.findOne({
    $or:[{username},{email}]
   })
   if(existedUser){
    throw new ApiError(409,"already exist")
   }

   const avatarLocalPath=req.files?.avatar[0]?.path;
   const coverImageLocalPath=req.files?.coverImage[0]?.path;
   if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
   }

   const avatar = await uploadOnCloundinary(avatarLocalPath);
   const coverImage = await uploadOnCloundinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
   }

   //create user object
   const user = await User.create({
    fullname,
    avatar:avatar.url,
    coverImage:coverImage?.url,
    email,
    password,
    username:username.toLowerCase()

   })

   //is user empty or not
   const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
   )

   if(!createdUser){
    throw new ApiError(500,"something went wrong while registering the user")
   }

   //ret res
   return res.status(201).json(
    new ApiResponse(201,createdUser,"User registered Successfully")
   )


})


export {registerUser}