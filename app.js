require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose');
const ejs = require("ejs")
const session = require('express-session')
const passport = require('passport');
const passportLocalMongoose = require("passport-local-mongoose")
//Google
const GoogleStrategy = require('passport-google-oauth20').Strategy;
//Facebook
const FacebookStrategy = require('passport-facebook');
const findOrCreate = require('mongoose-findorcreate')

const app = express()

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static("public"))

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true, useUnifiedTopology: true})
mongoose.set('useCreateIndex', true)

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  //Google
  googleId: String,
  //Facebook
  facebookId: String,
  secret: String
})

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema)

passport.use(User.createStrategy())

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

//Google
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_G_ID,
    clientSecret: process.env.CLIENT_G_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

//Facebook
passport.use(new FacebookStrategy({
    clientID: process.env.CLIENT_F_ID,
    clientSecret: process.env.CLIENT_F_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
  res.render("home")
})

//Google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
);

//Facebook
app.get('/auth/facebook',
  passport.authenticate('facebook')
);

app.get("/login", function(req, res){
  res.render("login")
})

//Google
app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect('/secrets');
  }
);

//Facebook
app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  }
);

app.get("/register", function(req, res){
  res.render("register")
})

app.get("/secrets", function(req, res){
  User.find({"secret": {$ne: null}}, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        res.render("secrets", {usersWithSecrets: foundUser})
      }
    }
  })
})

app.get("/submit", function(req, res){
  if (req.isAuthenticated()) {
    res.render("submit")
  } else {
    res.redirect("/login")
  }
})

app.post("/submit", function(req, res){
  const submittedSecret = req.body.secret

  User.findById(req.user.id, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret
        foundUser.save(function(){
          res.redirect("/secrets")
        })
      }
    }
  })
})

app.get("/logout", function(req, res){
  req.logout()
  res.redirect("/")
})

app.post("/register", function(req, res) {
  User.register({username: req.body.username}, req.body.password, function(err, user){
    if(err) {
      console.log(err);
      res.redirect("/register")
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/secrets")
      })
    }
  })
})

app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  })

  req.login(user, function(err){
    if(err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/secrets")
      })
    }
  })
})

app.listen(3000, function(){
  console.log("Server started on port 3000.");
})
