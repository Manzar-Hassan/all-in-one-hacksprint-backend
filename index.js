import express from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cors from "cors";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = process.env.PORT;
const MONGO_URL = process.env.MONGO_URL;

app.use(express.json());
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

async function createConnection() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  console.log("Mongodb connected!!💖");

  return client;
}

const client = await createConnection();

// users endpoints:
async function getHashedPassword(password) {
  const NO_OF_ROUNDS = 10;
  const salt = await bcrypt.genSalt(NO_OF_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}

async function checkUser(username) {
  return await client.db("Hacksprint").collection("users").findOne({ username });
}

app.post("/signup", async (request, response) => {
  const { username, password } = request.body;
  const isUserExist = await checkUser(username);

  if (isUserExist) {
    response.send({ msg: "user already exists!!" });
  } else if (password.length < 8) {
    response.send({ msg: "password must be more than 8 characters!!" });
  } else if (username.length < 5) {
    response.send({ msg: "username must be more than 4 characters long!!" });
  } else {
    const hashedPassword = await getHashedPassword(password);
    const result = await client.db("Hacksprint").collection("users").insertOne({
      username,
      password: hashedPassword,
    });

    result.acknowledged
      ? response.send({ msg: "Account created successfully!!" })
      : response.send({ msg: "Username already exists!!" });
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const isUserExist = await checkUser(username);

  if (isUserExist) {
    if (password.length < 8) {
      response
        .status(204)
        .send({ msg: "password must be more than 8 characters!!" });
    } else {
      const storedPassword = isUserExist.password;
      const isPasswordMatch = await bcrypt.compare(password, storedPassword);

      if (isPasswordMatch) {
        const token = jwt.sign({ id: isUserExist._id }, process.env.SECRET_KEY);
        response.status(200).send({ msg: "login successful!!" });
      } else {
        response.status(204).send({ msg: "Incorrect credentials!!" });
      }
    }
  } else {
    response.status(204).send({ msg: "please sign up!!" });
  }
});

// orders endpoints:
app.post("/orders", async (request, response) => {
  const data = request.body;
  const result = await client
    .db("Hacksprint")
    .collection("orders")
    .insertOne(data);

  result.acknowledged
    ? response.send({ msg: "Please wait while your food is being prepared!!" })
    : response.status(404).send({ msg: "Something went wrong !!" });
});

//reports endpoints:
app.post("/theatre", async (request, response) => {
  const data = request.body;
  const result = await client
    .db("Hacksprint")
    .collection("reports")
    .insertMany(data);

  result.acknowledged
    ? response.send({ msg: "Don't worry we  will take action within 24 hours!!" })
    : response.status(404).send({ msg: "Something went wrong !!" });
});

//payment confirmation and contactUs e-mail query
app.post("/confirm-payment", async (request, response) => {
  const data = request.body;

  const mailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.USER_MAIL,
      pass: process.env.USER_PASSWORD,
    },
  });

  const paymentDetails = {
    from: process.env.USER_MAIL,
    to: data.mail,
    subject: "All-in-one App Payment",
    text: data.msg,
  };

  mailTransporter.sendMail(paymentDetails, (error) => {
    error
      ? response.status(404).send({ msg: "payment failed!!" })
      : response.status(200).send({ msg: "payment successful!!" });
  });
});

app.listen(PORT, () => console.log(`App started in ${PORT}`));
