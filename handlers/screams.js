const {db} = require('../utils/admin')
const util = require('util')



const getAllScreams = (req, res) =>{
  db.collection('screams')
    .orderBy('createdAt', 'desc')
    .get()
    .then(docs =>{
      let scream = []
      docs.forEach(doc =>{
        scream.push({
          screamId:doc.id,
          ...doc.data()
        })
      })
      return res.json(scream)
    })
    .catch(error => console.error(error))
}

const postOneScream = (req, res)=>{
  if (req.body.body.trim() === '') {
    return res.status(400).json({ body: 'Body must not be empty' });
  }

  const newScream = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount:0,
    commentCount:0
  }
  db.collection('screams')
    .add(newScream)
    .then((doc) =>{
      const resScream = newScream
      resScream.screamId = doc.id
      res.json(resScream)
    })
    .catch(error=>{
      res.status(500).json({error: 'something went wrong'})
      console.error(error)
    })
}

const getScream = (req, res) => {
  let screamData = {}
  db.doc(`/screams/${req.params.screamId}`).get()
    .then(doc => {
      if(!doc.exists){
        return res.status(404).json({error:'Scream not found'})
      }
      screamData = doc.data()
      screamData.screamId = doc.id
      return db.collection('comments')
        .orderBy('createdAt', 'desc')
        .where('screamId','==', req.params.screamId).get()
    })
    .then(data => {
      screamData.comments = []
      data.forEach(doc => {
        screamData.comments.push(doc.data())
      })
      return res.json(screamData)
    })
    .catch(error => {
      console.error(error)
      return res.status(500).json({error:error.code})
    })
}

const postComment = (req,res) =>{
  if(req.body.body.trim()==='') return res.status(400).json({comment:'Must not be emptied'})
  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    screamId: req.params.screamId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl
  }
  db.doc(`/screams/${req.params.screamId}`).get()
    .then(doc=>{
      if(!doc.exists)
      {
        return res.status(404).json({error: 'Scream not found'})
      }
      return doc.ref.update({commentCount: doc.data().commentCount + 1})
    })
    .then (()=> db.collection('comments').add(newComment))
    .then(()=>res.json(newComment))
    .catch(error=>{
      console.error(error)
      return req.status(500).json({error:'Something went wrong'})
    })
}

const likeScream = (req, res) =>{
  const likeDocument = db.collection('likes').where('userHandle', '==', req.user.handle)
    .where('screamId', '==', req.params.screamId).limit(1)

  const screamDocument = db.doc(`/screams/${req.params.screamId}`)

  let screamData = {}

  screamDocument.get()
    .then(doc => {
      if(doc.exists){
        screamData = doc.data()
        screamData.screamId = doc.id
        return likeDocument.get()
      }else{
        return res.status(400).json({error: 'Scream not found'})
      }
    })
    .then(data => {
      if(data.empty){
        return db.collection('likes').add({
          screamId: req.params.screamId,
          userHandle: req.user.handle
        })
          .then(()=>{
            screamData.likeCount++
            return screamDocument.update({likeCount: screamData.likeCount})
          })
          .then(()=>{
            return res.json(screamData)
          })
      }else{
        return res.status(400).json({error:'Scream already liked'})
      }
    })
    .catch(error => {
      console.error(error)
      return res.status(500).json({error: error.code})
    })
}

const unlikeScream = (req,res) =>{
  const likeDocument = db.collection('likes').where('userHandle', '==', req.user.handle)
    .where('screamId', '==', req.params.screamId).limit(1)

  const screamDocument = db.doc(`/screams/${req.params.screamId}`)

  let screamData = {}

  screamDocument.get()
    .then(doc => {
      if(doc.exists){
        screamData = doc.data()
        screamData.screamId = doc.id
        return likeDocument.get()
      }else{
        return res.status(400).json({error: 'Scream not found'})
      }
    })
    .then(data => {
      if(data.empty){
        return res.status(400).json({error:'Scream already liked'})
      }else{
        return db.doc(`/likes/${data.docs[0].id}`).delete()
          .then(()=>{
            screamData.likeCount--
            return screamDocument.update({likeCount: screamData.likeCount})
          })
          .then(()=>res.json(screamData))
      }
    })
    .catch(error => {
      console.error(error)
      return res.status(500).json({error: error.code})
    })
}

const deleteScream =(req, res) =>{
  const document = db.doc(`/screams/${req.params.screamId}`)
  document.get()
    .then(doc=>{
      if(!doc.exists) {return res.status(404).json({error:'Scream not found'})}
      if(doc.data().userHandle !== req.user.handle) {return res.status(403).json({error: ' Unauthorized'})}
      else {return document.delete()}
    })
    .then(()=>res.json({message:'Scream deleted successfully'}))
    .catch(error=>{
      console.error(error)
      return  res.status(500).json({error: error.code})
    })
}
module.exports = {
  getAllScreams,
  postOneScream,
  getScream,
  postComment,
  likeScream,
  unlikeScream,
  deleteScream
}