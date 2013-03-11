var config = require("../config/" + (process.env.NODE_ENV || "development") + ".json"),
    pathlib = require("path"),
    express = require("express"),
    http = require("http"),
    app = express(),
    routes = require("./routes");

// Express.js configuration
app.configure(function(){
    // HTTP port to listen
    app.set("port", config.web.port);

    // Define path to EJS templates
    app.set("views", pathlib.join(__dirname, "..", "www", "views"));

    // Use EJS template engine
    app.set("view engine", "ejs");

    // Use gzip compression
    app.use(express.compress());

    // Parse POST requests
    app.use(express.bodyParser());

    // Use default Espress.js favicon
    app.use(express.favicon());

    // Log requests to console
    app.use(express.logger(config.loggerInterface));

    app.use(app.router);

    // Define static content path
    app.use(express["static"](pathlib.join(__dirname, "..", "www", "static")));

    //Show error traces
    app.use(express.errorHandler());
});

// Use routes from routes.js
routes(app);

/**
 * Starts listening HTTP port
 *
 * @param {Function} callback Callback function to run once the binding has been succeeded or failed
 */
module.exports.listen = function(callback){
    app.listen(app.get("port"), callback);
};