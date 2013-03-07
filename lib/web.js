var config = require("../config/" + (process.env.NODE_ENV || "development") + ".json"),
    pathlib = require("path"),
    express = require("express"),
    http = require("http"),
    domain = require('domain'),
    serverDomain = domain.create(),
    app = express(),
    routes = require("./routes");

app.configure(function(){
    app.set("port", config.port);
    app.set("views", pathlib.join(__dirname, "..", "www", "views"));
    app.set("view engine", "ejs");

    app.use(express.compress());
    app.use(express.bodyParser());

    app.use(express.favicon());
    app.use(express.logger(config.loggerInterface));
    
    app.use(app.router);

    app.use(express.static(pathlib.join(__dirname, "..", "www", "static")));
    app.use(express.errorHandler());
});

routes(app);

module.exports.listen = function(callback){
	// Domain for the server
	serverDomain.run(function () {
	    http.createServer(function (req, res) {

	        var reqd = domain.create();
	        reqd.add(req);
	        reqd.add(res);

	        // On error dispose of the domain
	        reqd.on('error', function (error) {
	            console.error('Error', error.code, error.message, req.url);
	            reqd.dispose();
	        });

	        // Pass the request to express
	        app(req, res);

	    }).listen(app.get("port"), callback);
	});	
}