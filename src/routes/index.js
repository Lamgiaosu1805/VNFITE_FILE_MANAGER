const fileRouter = require('./file')

const route = (app) => {
    app.use(`/`, fileRouter)
}

module.exports = route;