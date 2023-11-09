const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
const jwt = require("jsonwebtoken")
const cookieParser = require('cookie-parser')
const app = express()
require('dotenv').config()
const port = process.env.PORT || 5000

// midlewares
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}))

app.use(express.json())
app.use(cookieParser())


// Create custom middlewares

const logger = (req, res, next) => {
  console.log(req.hostname, req.method, req.url)
  next()
}
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log('valueof tocken in middlewares', token)
  try {
    if (!token) {
      return res.status(401).send({ message: 'unauthorized' })
    }
    jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
      if (err) {
        return res.status(403).send({ message: 'Page Not Found' })
      }
      console.log("Token Value", decoded)
      req.user = decoded
    })
    next()
  }
  catch {
    console.log("Invalied Token")
    return res.status(401).send({ message: 'unauthorized' })
  }
}

// database connections
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ghkhwep.mongodb.net/?retryWrites=true&w=majority`;

// const uri = 'mongodb://localhost:27017'


// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const assignmentsCollections = client.db("Group-Study").collection("assignments")
const submittedAssignmentCollections = client.db("Group-Study").collection("submittedAssignments")

async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    // Submission

    app.get("/submissions",logger, verifyToken, async (req, res) => {
      const assignments = submittedAssignmentCollections.find()
      const result = await assignments.toArray()
      res.send(result)
    })

    app.get("/submissions/:id",  logger,verifyToken, async (req, res) => {
      try {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await submittedAssignmentCollections.findOne(query)
        res.send(result)
      }
      catch {
        console.log("error")
      }
    })
    app.get("/submissions/user/:email", logger,verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const assignments = submittedAssignmentCollections.find(query)
      const result = await assignments.toArray()
      res.send(result)
    })
    app.get("/submissions/statusCode/:status", logger,verifyToken, async (req, res) => {
      try {
        const status = req.params.status
        const query = { status: status }
        const assignments = submittedAssignmentCollections.find(query)
        const result = await assignments.toArray()
        res.send(result)
      }
      catch {
        console.log("error")
      }
    })


    // Assignment
    app.get("/assignments", async (req, res) => {
      const page = parseInt(req.query.page)
      const size = parseInt(req.query.size)
      const result = await assignmentsCollections.find()
      .skip(page * size)
      .limit(size)
      .toArray()
      res.send(result)
      console.log("pagination", req.query, page, size)
    })

    app.get('/totalAssignemnt', async(req,res) => {
      const count = await assignmentsCollections.estimatedDocumentCount()
      res.send({count})
    })

    app.get("/assignments/:id", logger,verifyToken, async (req, res) => {
      try {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await assignmentsCollections.findOne(query)
        res.send(result)
      }
      catch {
        error =>
          console.log(error)
      }
    })

    app.get("/assignments/emailAdd/:email", logger,verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { creatorEmail: email }
      const assignments = assignmentsCollections.find(query)
      const result = await assignments.toArray()
      res.send(result)
    })

    app.get("/assignments/level/:difficulty", async (req, res) => {
      try {
        const difficultyLevel = req.params.difficulty
        const query = { difficulty: difficultyLevel }
        const filteredAssignment = assignmentsCollections.find(query)
        const result = await filteredAssignment.toArray()
        res.send(result)
      }
      catch {
        error =>
          console.log(error)
      }
    })

    // generate jwt for secure the api
    app.post("/jwt", async (req, res) => {
      const user = req.body
      console.log(user)
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, { expiresIn: '3h' })

      res
        .cookie('token', token, {
          httpOnly: true,
          secure: false,
          // sameSite: 'none'
        })
        .send({ success: true })
    })

    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log("Loggin out user:", user)
      res.clearCookie('token', { maxAge: 0 }).send({ success: true })
  })

    // Assignment
    app.post("/assignments", async (req, res) => {
      const assignments = req.body
      const result = await assignmentsCollections.insertOne(assignments)
      res.send(result)
    })

    // Submission
    app.post("/submissions", async (req, res) => {
      const submission = req.body
      const result = await submittedAssignmentCollections.insertOne(submission)
      res.send(result)
    })

    // Assignment
    app.patch("/assignments/:id", async (req, res) => {
      try {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const newAssignment = req.body
        const option = { upsert: true }
        const updatedAssignment = {
          $set: {
            title: newAssignment.title,
            description: newAssignment.description,
            marks: newAssignment.marks,
            image: newAssignment.image,
            difficulty: newAssignment.difficulty,
            dueDate: newAssignment.dueDate,
            updaterEmail: newAssignment.updaterEmail
          }
        }

        const result = await assignmentsCollections.updateOne(query, updatedAssignment)
        res.send(result)
        console.log(result)
      }
      catch {
        error => console.log(error)
      }
    })

    app.patch("/submissions/:id", async (req, res) => {
      try {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const submission = req.body
        const updatedSubmission = {
          $set: {
            feedback: submission.feedback,
            marks: submission.marks,
            status: submission.status
          }
        }

        const result = await submittedAssignmentCollections.updateOne(query, updatedSubmission)
        res.send(result)
        console.log(result)
      }
      catch {
        error => console.log(error)
      }
    })

    app.delete("/assignments/:id", async (req, res) => {
      try {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await assignmentsCollections.deleteOne(query)
        res.send(result)
      }
      catch {
        error =>
          console.log(error)
      }
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  }
  catch {
    console.log("Found an error, Please check")
  }
}
run().catch(console.dir);


app.get('/', (req, res) => res.send('Hello World!'))
app.listen(port, () => console.log(`This app listening on port ${port}!`))