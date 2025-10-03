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

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect=  await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password change Successfully"))

})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res.status(200).json(200,req.user,"current user fetch successfully")
})

const updateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullname,email} = req.body
    if(!fullname||!email){
        throw new ApiError(401,"fullname,email is required")
    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                fullname:fullname,
                email
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200),user,"Account details updated successfully")

})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath= req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const avatar = await uploadOnCloundinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400,"Error while uploading")
    }
    const user=await User.findByIdAndUpdate(req.user._id,{
        $set:{
            avatar:avatar.url
        }
    },{
        new:true
    }).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"avatar updated successfully"))


})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath= req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const coverImage = await uploadOnCloundinary(avatarLocalPath)
    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading")
    }
    const user=await User.findByIdAndUpdate(req.user._id,{
        $set:{
            coverImage:coverImage.url
        }
    },{
        new:true
    }).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"coverImage updated successfully"))
})

const  getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {usename} = req.params
    if(!username?.trim()){
        throw new ApiError(400,"username is not found")
    }
    const channel = await User.aggregate
    [
        {
            $match:{username:username?.toLowerCase()}
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addField:{
                subscriberCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                username:1,
                subscriberCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ]

    if(!channel?.length){
        throw new ApiError(404,"channel doesnot exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"user channel fetched successfully!")
    )

})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match:{
                //_id:req.user._id //idr monggiose kaam nhi krta so yeh sirf id string dega 
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {  //owner me prohject hoga 1st position pe
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        //owner ko thora systematic krne keliye
                        $addFields:{
                            owner: {$first:"$owner"}
                        }
                    }
                    
                ]
            }
        },
        
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200,user[0].watchHistory,"watchhistory fetched successfully")
    )
})


export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
   getWatchHistory 


}
