const express = require('express')
const app = express()
const route = require('./src/routes')
const morgan = require('morgan')
const db = require('./src/config/connectdb')
const ipClientWhitelistMiddleware = require('./src/middlewares.js/ipWhitelist')

require('dotenv').config();

//use middlewares
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({
    extended: true
}))
// app.use(ipClientWhitelistMiddleware);

db.connect();

//routing
route(app);

const port = process.env.PORT || 3000

app.listen(port, '0.0.0.0', () => {
  console.log(`App listening on port ${port}`)
});