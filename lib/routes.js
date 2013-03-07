var config = require("../config/" + (process.env.NODE_ENV || "development") + ".json"),
	api = require("./api");


module.exports = function(app){
    app.get("/", frontpage);

    app.get('/mailbox/:mailbox/json', serveMailboxJSON);
    app.get('/message/:message/json', serveMessageJSON);
    app.get('/message/:message/html', serveMessageHTML);

    app.get('/attachment/:message/:nr/:filename', serveAttachment);

};

function frontpage(req, res){
	res.setHeader("Content-Type", "text/html");
    res.render("index", {
    	title: config.title,
    	pageTitle: false,
    	page: "/"
    });
}

function serveMailboxJSON(req, res){
	var mailbox = (req.params.mailbox || "").toLowerCase().trim();
	console.log(mailbox)
	api.loadMailbox(mailbox, function(err, docs){
		if(err){
			console.log("WEB Error Mailbox JSON for " + mailbox);
			console.log(err);
			res.set('Content-Type', "application/json; Charset=utf-8");
        	res.send(500, JSON.stringify({success: false, error: err.message}));
        	return;
		}
		res.set('Content-Type', "application/json; Charset=utf-8");
        res.send(JSON.stringify({success: true, data: docs}));
	});
}

function serveMessageJSON(req, res){
	var message = (req.params.message || "").trim();
	console.log(message)
	api.loadMessage(message, function(err, doc){
		if(err){
			console.log("WEB Error Message JSON for " + message);
			console.log(err);
			res.set('Content-Type', "application/json; Charset=utf-8");
        	res.send(500, JSON.stringify({success: false, error: err.message}));
        	return;
		}
		res.set('Content-Type', "application/json; Charset=utf-8");
        res.send(JSON.stringify({success: true, data: doc}));
	});
}

function serveMessageHTML(req, res){
	var message = (req.params.message || "").trim();
	console.log(message)
	api.loadMessage(message, function(err, doc){
		if(err){
			console.log("WEB Error Message JSON for " + message);
			console.log(err);
			res.set('Content-Type', "text/plain; Charset=utf-8");
        	res.send(500, err.message);
        	return;
		}

		var base = req.protocol + '://' + req.host + "/",
			html;

        if(!doc.html.match(/<head\b[^>]*>/i)){
            html = "<!DOCTYPE html><html><head><base href=\""+base+"\" target=\"_top\"/><meta charset=\"utf-8\"><link rel=\"stylesheet\" href=\"/style/iframe.css\" /></head><body>" + doc.html + "</body></html>";
        }else{
            html = doc.html.replace(/(<head\b[^>]*>)/i, "$1\n<base href=\""+base+"\" target=\"_top\"/><meta charset=\"utf-8\">\n");
        }

        res.send(html);
	});
}

function serveAttachment(req, res){
	var message = (req.params.message || "").trim(),
		nr = Number(req.params.nr) || 0;
		
	api.loadAttachments(message, function(err, attachments){
		if(err){
			console.log("WEB Error Message Attachments for " + message);
			console.log(err);
			res.set('Content-Type', "text/plain; Charset=utf-8");
        	res.send(500, err.message);
        	return;
		}
		if(!attachments || !attachments[nr]){
			res.set('Content-Type', "text/plain; Charset=utf-8");
        	res.send(404, "Not found");
        	return;
		}
		res.set('Content-Type', attachments[nr].contentType);
        res.send(attachments[nr].content);
	});
}

