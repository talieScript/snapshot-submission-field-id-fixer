const express = require("express");
const bodyParser = require('body-parser')
const axios = require('axios')
const dayjs = require('dayjs')
const jsonParser = bodyParser.json()

require('dotenv').config()

const app = express();
const port = process.env.PORT || "8000";

const endpoint = process.env.SNAPSHOT_API_ENDPOINT;

app.use(express.json({limit: '50mb'}));

app.get("/", (req, res) => {
  res.status(200).send("Hello");
});

app.post("/", jsonParser, async (req, res) => {
  const {username, password, vesselName, vesselId} = req.body.user;
  // get auth token
  const authRes = await axios.post(`${endpoint}/auth/login`, { 
    username: username.trim(), password: password.trim() 
  }).catch(error => {
    console.log(error)
  })

  const authToken = authRes.data.accessToken;

  // get the correct ids
  const submissions = await axios.get(`${endpoint}/submissions?vesselName=${vesselName}&limit=100`, {
    headers: {
      'Authorization': `Bearer ${authToken}` 
    }
  })

  console.log(submissions.data)

  // get the form types
  const forms = await axios.get(`${endpoint}/forms?vesselId=${vesselId}&limit=100`, {
    headers: {
      'Authorization': `Bearer ${authToken}` 
    }
  })

  const extractedFieldIds = forms.data.reduce((forms, form) => {
    const formFields = form.fields.map((field) => field.id)
    forms[form.title.replace(/ /g,'')] = formFields
    return forms
  }, {})

  res.send(extractedFieldIds)

  // const correctIds = {
  //   positionReport
  // }

  



  // Get submissions that are incorect

  // loop through incorrect submissions and update their content with the correct ids 


})

/**
 * Server Activation
 */

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`);
});
