require("dotenv").config()
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const cookieParser = require("cookie-parser")
const express = require("express")
const db = require("better-sqlite3")("ourApp.db")
db.pragma("journal_mode = WAL")

//database setup here
const createTables = db.transaction(() => {
    db.prepare(
    `
    CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username STRING NOT NULL UNIQUE,
    password STRING NOT NULL
    )
    `
    ).run()
})

createTables()

//database setup ends here

const app = express()

app.set("view engine", "ejs")
app.use(express.urlencoded({extended: false}))
app.use(express.static("public"))
app.use(cookieParser())

app.use(function (req, res, next) {
    res.locals.errors = []

    // try to decode incoming cookie
    try{
        const decoded = jwt.verify(req.cookies.ourSimpleApp, process.env.JWTSECRET)
        req.user = decoded
    }
    catch(err){
        req.user = false
    }

    res.locals.user = req.user
    console.log(req.user);
    

    next()
})

app.get("/", (req, res) => {
    res.render("homepage")
})

app.get("/login", (req, res) => {
    res.render("login")
})

app.post("/register", (req, res) => {
    const errors = []
  
    if (typeof req.body.username !== "string") req.body.username = ""
    if (typeof req.body.password !== "string") req.body.password = ""
  
    req.body.username = req.body.username.trim()
  
    if (!req.body.username) errors.push("You must provide a username.")
    if (req.body.username && req.body.username.length < 3) errors.push("Username must be at least 3 characters.")
    if (req.body.username && req.body.username.length > 10) errors.push("Username cannot exceed 10 characters.")
    if (req.body.username && !req.body.username.match(/^[a-zA-Z0-9]+$/)) errors.push("Username can only contain letters and numbers.")
    
    if (errors.length) {
        return res.render("homepage", {errors})
    }

    // save the new user into a database
    const salt = bcrypt.genSaltSync(10)
    req.body.password = bcrypt.hashSync(req.body.password, salt)

     const ourStatement = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)")
     const result = ourStatement.run(req.body.username, req.body.password)

     const lookupStatement = db.prepare("SELECT * FROM users WHERE ROWID = ?")
     const ourUser = lookupStatement.get(result.lastInsertRowid)

    // log the user in by giving them a cookie
    const ourTokenValue = jwt.sign(
        { exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, skyColor: "blue", userid: ourUser.id, username: ourUser.username },
        process.env.JWTSECRET
      )

    res.cookie("ourSimpleApp", ourTokenValue, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24
    })

    res.send("Thank you!")
})

app.listen(3000)