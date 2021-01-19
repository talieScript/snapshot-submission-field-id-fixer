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
  const debugDump = req.body.debugDump;
  const {username, password} = req.body.user;
  // get auth token
  const authRes = await axios.post(`${endpoint}/auth/login`, 
  { username: username.trim(), password: password.trim() })
    .catch(error => {
    console.log(error)
  })

  const authToken = authRes.data.accessToken;

  // parse submission to how endpoint wants them
  const submissionsGlobals = debugDump.collections
    .find(col => col.name === 'submissionglobals').docs

  const formattedSubmissions = debugDump.collections
    .find(collection => collection.name === 'submissions')
    .docs.filter(sub => dayjs(sub.reportDate).isAfter(dayjs('1/10/2020')))
    .map(sub => {

    const { id, reportDate, status, title, vesselId, content, formId, formVersion} = sub
    const subGlobals = submissionsGlobals.filter(global => {
      return global.submissionId === id
    }).map((global) => {
      delete global.created
      delete global.updated
      return global
    })
    return {
      id,
      reportDate,
      status,
      title, 
      vessel: {
        id: vesselId
      },
      content,
      authorName: 'Bridge',
      form: {
        id: formId,
        version: formVersion,
      },
      globalValues: subGlobals,
    }
  })

  let failedSubmissions = []

  // send submissisons 
  const promises = formattedSubmissions.map(async (sub) => {
    const promise = await axios.post(`${endpoint}/submissions`, sub, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    }).catch(() => {
      failedSubmissions.push(sub)
    })
    return promise
  })

  await Promise.all(promises).then(() => {
    res.send({
      passed: formattedSubmissions.length - failedSubmissions.length,
      outOf: formattedSubmissions.length,
      failedSubmissions,
    })
  })
})

/**
 * Server Activation
 */

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`);
});
