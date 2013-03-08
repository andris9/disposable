var config = require("../config/" + (process.env.NODE_ENV || "development") + ".json"),
    pathlib = require("path"),
    express = require("express"),
    http = require("http"),
    app = express(),
    routes = require("./routes");

app.configure(function(){
    app.set("port", config.web.port);
    app.set("views", pathlib.join(__dirname, "..", "www", "views"));
    app.set("view engine", "ejs");

    app.use(express.compress());
    app.use(express.bodyParser());

    app.use(express.favicon());
    app.use(express.logger(config.loggerInterface));

    app.use(app.router);

    app.use(express["static"](pathlib.join(__dirname, "..", "www", "static")));
    app.use(express.errorHandler());
});

routes(app);

module.exports.listen = function(callback){
    app.listen(app.get("port"), callback);
};