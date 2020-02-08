const {admin, db} = require('../utils/admin')
const firebase = require('firebase')
const config = require('../utils/config')
const validator = require('../utils/validator')
firebase.initializeApp(config.firebaseConfig)


const signup = (req,res)=>{
  let token, userId
  
  const newUser={
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle
  }
  
  // Validation
  
  const {valid, errors}=validator.validateSignup(newUser)
  
  if(!valid) return res.status(400).json(errors)
  const noImg = 'no-img.png'
  // Refactor with async/await
  db.doc(`/users/${newUser.handle}`).get()
    .then(doc=>{
      if(doc.exists){
        return res.status(400).json({handle: 'This handle is already taken'})
      } else{
        return firebase.auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password)
      }
    })
    .then(data =>{
      userId=data.user.uid
      return data.user.getIdToken()})
    .then(idToken=>{
      token=idToken
      const userCredentials ={
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.firebaseConfig.storageBucket}/o/${noImg}?alt=media`,
        userId
      }
      return db.doc(`/users/${newUser.handle}`).set(userCredentials)
    })
    .then(()=>{
      return res.status(201).json({token})
    })
    .catch(error=>{
      console.error(error)
      if(error.code==='auth/email-already-in-use'){
        return res.status(400).json({email: 'Email is already in usage'})
      }
      res.status(500).json({general: 'Something went wrong, please try again'})
    })
}

const login = (req,res)=>{
  const user={
    email: req.body.email,
    password: req.body.password
  }
  const {valid, errors} = validator.validateLogin(user)
  if(!valid) return res.status(400).json(errors)

  
  firebase.auth().signInWithEmailAndPassword(user.email, user.password)
    .then(data=>{
      return data.user.getIdToken()
    })
    .then(token => {
      return res.json({token})
    })
    .catch(error => {
      console.error(error)
      return res.status(403).json({general:'Wrong credentials, please try again'})      
    })
}

// User photo
const uploadImage=(req,res)=>{
  const BusBoy = require('busboy')
  const path = require('path')
  const os = require('os')
  const fs = require('fs')
  const busboy = new BusBoy({headers: req.headers})
  let imageFileName
  let imageToBeUploaded={}
  busboy.on('file', (fieldname, file, filename, encoding, mimetype)=>{
    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
      return res.status(400).json({ error: 'Wrong file type submitted' })
    }
    const imageExtension = filename.split('.')[filename.split('.').length-1]
    imageFileName = `${Math.round(Math.random()*10000000000).toString()}.${imageExtension}`
    const filepath = path.join(os.tmpdir(), imageFileName)
    imageToBeUploaded = {filepath, mimetype}
    file.pipe(fs.createWriteStream(filepath))
  })
  busboy.on('finish', ()=>{
    admin.storage()
      .bucket(config.firebaseConfig.storageBucket)
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata:{
            contentType: imageToBeUploaded.mimetype
          }
        }
      }
      )
      .then(()=>{
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.firebaseConfig.storageBucket}/o/${imageFileName}?alt=media`
        return db.doc(`/users/${req.user.handle}`).update({imageUrl})
      })
      .then(()=>{
        return res.json({message:'Image uploaded successfully'})
      })
      .catch(error =>{
        console.error(error)
        return res.status(500).json({error: error.code})
      })
  })
  busboy.on('error', (error)=>{
    console.error('req.busboy error' + error)
    return res.status(500).json({error: error.code})
  })
    
  busboy.end(req.rawBody)
  
}
// Update profile information of the user
const updateProfileInfo = (req, res) => {
  let userDetails = validator.reduceUserDetails(req.body)

  db.doc(`/users/${req.user.handle}`).update(userDetails)
    .then(()=> res.json({message: 'Profile information updated successfully'}))
    .catch(error=>{
      console.error(error)
      return res.status(500).json({error: error.code})
    })
}
// Get User detail
const getAuthedUser = (req, res) =>{
  let userData = {}
  db.doc(`/users/${req.user.handle}`).get()
    .then(doc=>{
      if(doc.exists)
      {
        userData.credentials = doc.data()
        return db.collection('likes').where('userHandle',  '==', req.user.handle).get()
      }
    })
    .then(data =>{
      userData.likes = []
      data.forEach(doc => {
        userData.likes.push(doc.data())
      })
      return db.collection('notifications').where('recipient', '==', req.user.handle)
        .orderBy('createdAt', 'desc').limit(20).get()
      
    })
    .then(data=>{
      userData.notification = []
      data.forEach(doc=>{
        userData.notification.push({
          recipient: doc.data().recipient,
          sender: doc.data().sender,
          createdAt: doc.data().createdAt,
          screamId: doc.data().screamId,
          type: doc.data().type,
          read: doc.data().read,
          notificationId: doc.id
        })
      })
      return res.json(userData)
    })
    .catch(error =>{
      console.error(error)
      return res.status(500).json({error: error.code})
    })
}
// Get other user detail
const getUserDetails= (req,res)=>{
  let userData = {}
  db.doc(`/users/${req.params.handle}`).get()
    .then(doc =>{
      if(doc.exists){
        userData.user = doc.data()
        return db.collection('screams').where('userHandle', '==', req.params.handle)
          .orderBy('createdAt', 'desc')
          .get()
      }else{
        return res.status(404).json({error: 'User not found'})
      }
    })
    .then(data =>{
      userData.screams = []
      data.forEach(doc =>{
        userData.screams.push({
          body:doc.data().body,
          createdAt:doc.data().createdAt,
          userHandle:doc.data().userHandle,
          userImage:doc.data().userImage,
          likeCount:doc.data().likeCount,
          commentCount:doc.data().commentCount,
          screamId:doc.id
        })
      })
      return res.json(userData)
    })
    .catch(error=>{
      console.error(error)
      return res.status(500).json({error: error.code})
    })
}
//mark Notification as read 
const markNotificationsRead=(req,res)=>{
  let batch = db.batch()
  req.body.forEach(notificationId =>{
    const notification = db.doc(`/notifications/${notificationId}`)
    batch.update(notification, {read:true})
  })
  batch.commit()
    .then(()=>res.json({message: ' Notification marked read'}))
    .catch(error=>{
      console.error(error)
      return res.status(500).json({error: error.code})
    })
}
module.exports = {
  signup,
  login,
  uploadImage,
  updateProfileInfo,
  getAuthedUser,
  getUserDetails,
  markNotificationsRead
}