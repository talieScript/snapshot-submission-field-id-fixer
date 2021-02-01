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



/**
 * Exmaple request:
 * 
 * {
    "username": "stratum",
    "password": "*********",
    "vesselId": 204,
    "vesselName": "NAVIG8 ADAMITE",
    "date": "2021-01-27T05:33:57.997Z"
    }


    Make sure the vessel name is the same as it apires in the database and the id matches.
    The date is the report date you want to start the script from going back.
    For the users name and password you can use the vessels log in details or just any super user. 
    Before running this on Prod, you will also wnat to temporarily remove the emails from the fleet to avoid swamping metops and navig8 with emails.
 */
app.post("/", jsonParser, async (req, res) => {
  const {username, password, vesselName, vesselId, date} = req.body;
  // get auth token
  const authRes = await axios.post(`${endpoint}/auth/login`, { 
    username: username.trim(), password: password.trim() 
  }).catch(error => {
    console.log('error')
  })

  const authToken = authRes.data.accessToken;

  // get the form types
  const forms = await axios.get(`${endpoint}/forms?vesselId=${vesselId}&limit=100`, {
    headers: {
      'Authorization': `Bearer ${authToken}` 
    }
  })
  // console.log({forms})

  const extractedFieldIds = forms.data.reduce((forms, form) => {
    const formFields = form.fields.map((field) => field.id)
    forms[form.title.replace(/ /g,'')] = formFields
    return forms
  }, {})

  // Get submissions ids that are incorect
  const submissionsRes = await axios.get(`${endpoint}/submissions?vesselName=${vesselName}&limit=0`, {
    headers: {
      'Authorization': `Bearer ${authToken}` 
    }
  })

  const effectedSubmissions = submissionsRes.data.items.filter((sub) => {
    return dayjs(sub.reportDate).isBefore(dayjs(date))
  })

  // console.log('here2')

  // loop through incorrect submissions and update their content with the correct ids
  const promises = effectedSubmissions.map(async (sub, index) => {
    // if(index > 1) {
    //   return { data: null }
    // }
    console.log('index - ', index)
    // console.log(sub.title)
    const form = forms.data.filter(form => form.id === sub.formId).find(form => form.version === sub.formVersion)
    // console.log({form})

    // return;
    // const globalValues = await axios.get(`${endpoint}/submissions/${sub.id}/globals`, {
    //   headers: {
    //     'Authorization': `Bearer ${authToken}` 
    //   }
    // })
    // return;
    const ids = extractedFieldIds[sub.title.replace(/ /g,'')]
    const content = Object.values(sub.content).reduce((contentObj, value, index) => {
      const id = ids[index]
      contentObj[id] = value
      return contentObj
    }, {})

    // console.log(sub)
    // console.log(form)

    const data = {
      ...sub,
      vessel: {
        id: vesselId
      },
      form: {
        id: form.id,
        version: form.version
      },
      globalValues: [],
      authorName: 'Talie\'s Bot',
      content
    }

    // console.log('here4')

    // return {data}

     const res = await axios.put(`${endpoint}/submissions/${sub.id}`, data, {
      headers: {
        'Authorization': `Bearer ${authToken}` 
      }
    })

    return {
      data: [res.data],
    }
  })

  const putRes = await Promise.all(promises)


  res.send(putRes.map(res => res.data))
})

/**
 * Server Activation
 */

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`);
});
