import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloundinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTohens = async (userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken=refreshToken
        user.save({validateBeforeSave:false})

        return {accessToken,refreshToken}
        
    } catch (error) {
        throw new ApiError(500,"Somenthing Went Wrong While Generating Access And Refrsh Token")
    }
}

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
    //console.log("email:", email);

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
   //console.log("avatarLocalPath:", avatarLocalPath);
   //const coverImageLocalPath=req.files?.coverImage[0]?.path;
   let coverImageLocalPath
   if(req.files && Array.isArray(req.files.coverImage)&& req.files.coverImage.length>0){
    coverImageLocalPath=req.files.coverImage[0].path
   }
   
   if(!avatarLocalPath){
        throw new ApiError(400, "No avatar file found in req.files");
   }

   const avatar = await uploadOnCloundinary(avatarLocalPath);
   //console.log("avatar upload result:", avatar);
   const coverImage = await uploadOnCloundinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Cloudinary upload failed for avatar");
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

const loginUser = asyncHandler(async(req,res)=>{
    //req body -> data
    // username ,email 
    //find the user
    //if exist password check
    //access and refreshtoken when pass check
    //send cookies
    const {username,email,password}=req.body
    if (!username && !email){
        throw new ApiError(404, "username or email is req");
        
    }
    console.log("Login attempt with:", { username, email });
    
    const user = await User.findOne({
        $or:[{username:username?.toLowerCase()},{email}]
    })
    if(!user){
        throw new ApiError(404, "user doesnot exist")
    }
    const isPasswordValid =  await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credential")
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshTohens(user._id)
    const loggedInUser=await User.findById(user._id).select("-password -refreshToken")
    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200).cookie("accessToken",accessToken,options).cookie("refreshToken",refreshToken,options).json(new ApiResponse(200,{
        user:loggedInUser,accessToken,refreshToken
    },
    "user loggedinuser successfully"
))


})

const logOutUser = asyncHandler(async(req,res)=>{
    //cookies clear
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )
    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200).clearCookie("accessToken",options).clearCookie("refreshToken",options).json(new ApiResponse(200,{},"User LogOut Successfull"))

})

const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"UnAuthorized Request")
    }
    try {
        const decodedtoken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedtoken?._id)
        if(!user){
            throw new ApiError(404, "Invalid Refresh Token")
        }
        if(incomingRefreshToken != user?.refreshToken){
            throw new ApiError(404, " Refresh Token is Expired or Used")
        }
    
        const {accessToken,newrefreshToken}=await generateAccessAndRefreshTohens(user._id)
    
        const options ={
            httpOnly:true,
            secure:true
        }
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newrefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken:newrefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message||"Invalid refresh token")
    }
})

export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
}
