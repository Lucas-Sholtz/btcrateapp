const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const fetch = require("node-fetch");
const hbs = require("hbs");
const bcrypt = require("bcrypt");
  
const app = express();
const jsonParser = express.json();
const urlencodedParser = bodyParser.urlencoded({ extended: false });
const usersPath = "users.json"; 
const tokenPath = "users_tokens.json";
const btcrateUrl = "https://api.coindesk.com/v1/bpi/currentprice/UAH.json";
const settings = { method: "Get" };

app.set("view engine", "hbs");
hbs.registerPartials(__dirname + "/views/partials");
app.use(cookieParser());

app.get("/user/create", urlencodedParser, function (request, response) {
    response.render("create.hbs");
});

app.post("/user/create", urlencodedParser, function (request, response) {
    if(!request.body) return response.sendStatus(400);
    console.log(request.body);

    let newEmail = request.body.userEmail;
    let newPassword = request.body.userPassword;
    let hashedPassword = bcrypt.hashSync(newPassword, 10);
    let newUser = { email: newEmail, password: hashedPassword };

    let data = fs.readFileSync(usersPath, "utf-8");
    let users = JSON.parse(data);

    let exists = false;
    for (let i = 0; i < users.length; i++) {
        if (users[i].email == newUser.email) {
            exists = true;
        }
    }

    if (exists) {
        response.send("User already exists!");
    } else {
        users.push(newUser);
        fs.writeFileSync(usersPath, JSON.stringify(users), "utf-8");
        response.send(`Email: ${newEmail}<br> Password: ${newPassword}<br><br>Succesfully created!<br><a href="/user/login">Login</a>`);
    }
})

app.get("/user/login", urlencodedParser, function (request, response) {
    response.render("login.hbs");
});

app.post("/user/login", urlencodedParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    let userEmail = request.body.userEmail;
    let userPassword = request.body.userPassword;

    let data = fs.readFileSync(usersPath, "utf-8");
    let users = JSON.parse(data);

    for (let i = 0; i < users.length; i++) {
        if (users[i].email == userEmail) {
            if (bcrypt.compareSync(userPassword, users[i].password)) {
                let newToken = bcrypt.genSaltSync();
                let tokenData = fs.readFileSync(tokenPath);
                let userTokens = JSON.parse(tokenData);

                let exists = false;
                for (let j = 0; j < userTokens.length; j++) {
                    if (userTokens[j].email == userEmail) {
                        exists = true;
                        userTokens[i].token = newToken;
                    }
                }
                if (!exists) {
                    let userToken = { email: userEmail, token: newToken };
                    userTokens.push(userToken);
                }
                fs.writeFileSync(tokenPath, JSON.stringify(userTokens), "utf-8");
                response.cookie("token", newToken, { maxAge: 90000 })
                    .cookie("email", userEmail, { maxAge: 90000 })
                    .send("Succesfully logged in <br><a href=\"/btcrate\">View rate</a>");
            } else {
                response.send("Incorrect email or password");
            }
        }
    }
    response.send("User does not exist");
});

app.get("/btcrate", function (request, response) {
    let email = request.cookies["email"];
    let token = request.cookies["token"];

    if (email == undefined || token == undefined) {
        response.render("accessdenied.hbs");
    }

    let data = fs.readFileSync(tokenPath);
    let userTokens = JSON.parse(data);

    let correct = false;
    for (let i = 0; i < userTokens.length; i++) {
        if (userTokens[i].email == email) {
            if (userTokens[i].token == token)
                correct = true;
        }
    }

    if (correct)
    {
        fetch(btcrateUrl, settings)
            .then(res => res.json())
            .then((json) => {
                response.render("btcrate.hbs", {
                    btcRate: json.bpi.UAH.rate,
                    time: json.time.updated
                });
            });
    } else {
        response.render("accessdenied.hbs");
    }
});

app.listen(3000);