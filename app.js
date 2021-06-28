const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const fetch = require("node-fetch");
const hbs = require("hbs");
const bcrypt = require("bcrypt");
  
const app = express();
const urlencodedParser = bodyParser.urlencoded({ extended: false });
const usersPath = "users.json"; 
const tokenPath = "users_tokens.json";
const btcrateUrl = "https://api.coindesk.com/v1/bpi/currentprice/UAH.json";
const settings = { method: "Get" };

app.set("view engine", "hbs");
hbs.registerPartials(__dirname + "/views/partials");

app.use(cookieParser());

app.get("/", function (request, response) {
    response.redirect("/user/create");
});

app.get("/user/create", function (request, response) { //on /user/create GET simply render page
    response.render("create.hbs");
});

app.post("/user/create", urlencodedParser, function (request, response) { //on /user/create POST
    if(!request.body) return response.sendStatus(400); //check for empty body

    let newEmail = request.body.userEmail;
    let newPassword = request.body.userPassword;
    let hashedPassword = bcrypt.hashSync(newPassword, 10);
    let newUser = { email: newEmail, password: hashedPassword };

    let data = fs.readFileSync(usersPath, "utf-8");
    let users = JSON.parse(data);

    let exists = false;
    for (let i = 0; i < users.length; i++) { //check database
        if (users[i].email == newUser.email) {
            exists = true;
        }
    }

    if (exists) {
        response.send("User already exists!"); //user cannot register to the same mail 
    } else {
        users.push(newUser); //add new user to array
        fs.writeFileSync(usersPath, JSON.stringify(users), "utf-8"); //and write it to database
        response.send(`Email: ${newEmail}<br> Password: ${newPassword}<br><br>Succesfully created!<br><a href="/user/login">Login</a>`);
    }
})

app.get("/user/login", function (request, response) { //on /user/login GET simply render page
    response.render("login.hbs");
});

app.post("/user/login", urlencodedParser, function (request, response) {
    if (!request.body) return response.sendStatus(400); //check for empty body

    let userEmail = request.body.userEmail;
    let userPassword = request.body.userPassword;

    let data = fs.readFileSync(usersPath, "utf-8");
    let users = JSON.parse(data);

    for (let i = 0; i < users.length; i++) { //find user with same email 
        if (users[i].email == userEmail) {
            if (bcrypt.compareSync(userPassword, users[i].password)) { //compare passwords
                let newToken = bcrypt.genSaltSync(); //generate unique token for user
                let tokenData = fs.readFileSync(tokenPath);
                let userTokens = JSON.parse(tokenData);

                let exists = false;
                for (let j = 0; j < userTokens.length; j++) { //check database
                    if (userTokens[j].email == userEmail) {
                        exists = true;
                        userTokens[i].token = newToken; //if it already exists, change data
                    }
                }
                if (!exists) { //if not, add it to array
                    let userToken = { email: userEmail, token: newToken };
                    userTokens.push(userToken);
                }
                fs.writeFileSync(tokenPath, JSON.stringify(userTokens), "utf-8"); //write database

                response.cookie("token", newToken, { maxAge: 90000 }) //unique token for login stored in cookies
                    .cookie("email", userEmail, { maxAge: 90000 }) //logged user email stored in cookies
                    .send("Succesfully logged in <br><a href=\"/btcrate\">View rate</a>");
            } else {
                response.send("Incorrect email or password"); //user entered wrong password
            }
        }
    }
    response.send("User does not exist"); //user tryed to login with non-existent email
});

app.get("/btcrate", function (request, response) { //on /btcrate GET
    //parse cookies
    let email = request.cookies["email"];
    let token = request.cookies["token"];

    if (email == undefined || token == undefined) {
        response.render("accessdenied.hbs"); //denie access if cookies empty
    }

    let data = fs.readFileSync(tokenPath);
    let userTokens = JSON.parse(data);

    let correct = false;
    for (let i = 0; i < userTokens.length; i++) { //check database
        if (userTokens[i].email == email) { //find email
            if (userTokens[i].token == token) //and compare tokens
                correct = true;
        }
    }

    if (correct) 
    {
        fetch(btcrateUrl, settings) //get BTC rate JSON from api.coindesk.com
            .then(res => res.json())
            .then((json) => {
                response.render("btcrate.hbs", { //render rate page and replace placeholders
                    btcRate: json.bpi.UAH.rate,
                    time: json.time.updated
                });
            });
    } else {
        response.render("accessdenied.hbs"); //incorrect email or token
    }
});

app.listen(3000); //app runs on http://localhost:3000