const fileRouter = require('./file')

const route = (app) => {
    app.use(`/file`, fileRouter)
}

module.exports = route;