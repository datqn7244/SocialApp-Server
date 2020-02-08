/* eslint-disable no-undef */
const functions = require('firebase-functions')
const {db}= require('./utils/admin')
const express = require('express')
const app = express()
const screams = require('./handlers/screams')
const user = require('./handlers/user')
const FBAuth = require('./utils/fbauth')

const cors = require('cors')

app.use(cors())
// All Scream function--------------------------------------------------
// Get All Screams
app.get('/screams', screams.getAllScreams)
// Posting scream
app.post('/screams', FBAuth.FBAuth, screams.postOneScream)
// Get a scream
app.get('/screams/:screamId', screams.getScream)
// Post a comment
app.post('/screams/:screamId/comment', FBAuth.FBAuth, screams.postComment)
//lile a scream
app.get('/screams/:screamId/like', FBAuth.FBAuth, screams.likeScream)
//unlike a scream
app.get('/screams/:screamId/unlike', FBAuth.FBAuth, screams.unlikeScream)
//Delete Scream
app.delete('/screams/:screamId', FBAuth.FBAuth, screams.deleteScream)



// All User function--------------------------------------------------------
// Signup route
app.post('/signup', user.signup)
// Sign in
app.post('/login', user.login)
// Avatar
app.post('/user/image', FBAuth.FBAuth, user.uploadImage)
//Update profile info
app.post('/user', FBAuth.FBAuth, user.updateProfileInfo)
// Get user information
app.get('/user', FBAuth.FBAuth, user.getAuthedUser)
// Get other user detail
app.get('/user/:handle', user.getUserDetails)
// Mark Notification as Read
app.post('/notifications', user.markNotificationsRead)



exports.api = functions.region('europe-west1').https.onRequest(app) 


//Notification functions
exports.createNotificationOnLike = functions.region('europe-west1').firestore.document('likes/{id}')
  .onCreate((snapshot)=>{
    return db.doc(`/screams/${snapshot.data().screamId}`).get()
      .then(doc=>{
        if(doc.exists && doc.data().userHandle!==snapshot.data().userHandle){
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            screamId: doc.id
          })
        }
      })
      .then(()=>{
        return
      })
      .catch((error)=>{
        console.error(error)
      })
  })
exports.deleteNotificationOnUnLike = functions.region('europe-west1').firestore.document('likes/{id}')
  .onDelete((snapshot)=>{
    return db.doc(`/notifications/${snapshot.id}`).delete()
      .catch((error)=>{
        console.error(error)
        return
      })
  })
exports.createNotificationOnComment = functions.region('europe-west1').firestore.document('comments/{id}')
  .onCreate((snapshot)=>{
    return db.doc(`/screams/${snapshot.data().screamId}`).get()
      .then(doc=>{
        if(doc.exists && doc.data().userHandle!==snapshot.data().userHandle){
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'comment',
            read: false,
            screamId: doc.id
          })
        }
      })
      .then(()=>{
        return
      })
      .catch((error)=>{
        console.error(error)
        return
      })
  })

exports.onUserImageChange = functions.region('europe-west1').firestore.document('/users/{userId}')
  .onUpdate((change) => {
    if(change.before.data().imageUrl !== change.after.data().imageUrl)
    {
      let batch = db.batch()
      return  db.collection('screams').where('userHandle','==', change.before.data().handle).get()
        .then((data)=>{
          data.forEach(doc=>{
            const scream = db.doc(`/screams/${doc.id}`)
            batch.update(scream, {userImage:  change.after.data().imageUrl})
          }) 
          return  db.collection('comments').where('userHandle','==', change.before.data().handle).get()
        })
        .then((data)=>{
          data.forEach(doc=>{
            const comment = db.doc(`/comments/${doc.id}`)
            batch.update(comment, {userImage:  change.after.data().imageUrl})
          })
          return batch.commit()
        })
    }
    else return true 
  })

exports.onScreamDelete =  functions.region('europe-west1').firestore.document('/screams/{screamId}')
  .onDelete((snapshot, context) => {
    const screamId = context.params.screamId
    const batch = db.batch()
    return db.collection('comments').where('screamId','==', screamId).get()
      .then(data=>{
        data.forEach(doc =>{
          batch.delete(db.doc(`/comments/${doc.id}`))
        })
        return db.collection('likes').where('screamId', '==', screamId).get()})
      .then(data => {
        data.forEach(doc=>{
          batch.delete(db.doc(`/likes/${doc.id}`))
        })
        return db.collection('notifications').where('screamId', '==', screamId).get()})
      .then(data=>{
        data.forEach(doc=>{
          batch.delete(db.doc(`/notifications/${doc.id}`))
        })
        return batch.commit()
      })
      .catch(error=>console.error(error))
  })
  
  