var config = require("../config/" + (process.env.NODE_ENV || "development") + ".json"),
    api = require("./api"),
    crypto = require("crypto"),
    fs = require("fs");


module.exports = function(app){
    app.get("/", serveFrontpage);
    app.get('/about', serveAbout);
    app.post('/redir', serveRedirect);

    app.get('/mailbox/:mailbox/json', serveMailboxJSON);
    app.get('/mailbox/:mailbox/rss', serveMailboxRSS);
    app.get('/message/:message/json', serveMessageJSON);
    app.get('/message/:message/html', serveMessageHTML);
    app.get('/message/:message/eml', serveMessageRaw);

    app.get('/attachment/:message/:nr/:filename', serveAttachment);

    app.get('/mailbox/:mailbox', serveMailbox);
    app.get('/message/:message', serveMessage);

    app.get('/delete/:mailbox/:message', deleteMessage);

    app.post('/mailbox/:mailbox/upload', uploadMessage);
};

function serveFrontpage(req, res){
    res.setHeader("Content-Type", "text/html");
    res.render("index", {
        title: config.title,
        hostname: config.hostname,
        pageTitle: false,
        page: "/"
    });
}

function serveAbout(req, res){
    res.setHeader("Content-Type", "text/html");
    res.render("index", {
        title: config.title,
        hostname: config.hostname,
        pageTitle: "About",
        page: "/about"
    });
}

function serveRedirect(req, res){
    var mailbox = (req.body.mailbox || "").toString().trim().toLowerCase() ||
        (crypto.randomBytes(4).toString("hex") + "@" + config.hostname);

        if(!mailbox.match(/@/)){
            mailbox += "@" + config.hostname;
        }

    return res.redirect("/mailbox/" + encodeURIComponent(mailbox));
}

function serveMailbox(req, res){
    var mailbox = (req.params.mailbox || "").toLowerCase().trim(),
        errors = {
            "missing-file": "Upload failed: Empty or missing file",
            "too-large-file": "Upload failed: message file was larger than allowed " + config.smtp.maxSize + " Bytes"
        };

    if(!mailbox.match(/@/)){
        mailbox += "@" + config.hostname;
    }

    api.loadMailbox(mailbox, function(err, docs){
        if(err){
            console.log("WEB Error Mailbox for " + mailbox);
            console.log(err);
            res.render("index", {
                title: config.title,
                hostname: config.hostname,
                pageTitle: "Mailbox for " + mailbox,
                page: "/error",
                message: err.message
            });
            return;
        }
        res.render("index", {
            title: config.title,
            hostname: config.hostname,
            pageTitle: "Mailbox for " + mailbox,
            page: "/mailbox",
            mailbox: mailbox,
            message: req.query.message,
            error: req.query.error && errors[req.query.error],
            pop3port: config.pop3.port,
            docs: docs
        });
    });
}

function serveMailboxJSON(req, res){
    var mailbox = (req.params.mailbox || "").toLowerCase().trim();

    if(!mailbox.match(/@/)){
        mailbox += "@" + config.hostname;
    }

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

function serveMailboxRSS(req, res){
    var mailbox = (req.params.mailbox || "").toLowerCase().trim();

    if(!mailbox.match(/@/)){
        mailbox += "@" + config.hostname;
    }

    api.loadMailbox(mailbox, true, function(err, docs){
        if(err){
            console.log("WEB Error Mailbox RSS for " + mailbox);
            console.log(err);
            res.set('Content-Type', "application/json; Charset=utf-8");
            res.send(500, JSON.stringify({success: false, error: err.message}));
            return;
        }
        res.set('Content-Type', "application/rss+xml; Charset=utf-8");
        res.render("feed",{
            title: config.title,
            mailbox: mailbox,
            hostname: config.hostname + ([80, 443].indexOf(config.web.port)<0?":"+config.web.port:""),
            docs: docs
        });
    });
}

function serveMessage(req, res){
    var message = (req.params.message || "").trim();

    api.loadMessage(message, function(err, doc){
        if(err){
            console.log("WEB Error Message JSON for " + message);
            console.log(err);
            res.render("index", {
                title: config.title,
                hostname: config.hostname,
                pageTitle: "",
                page: "/error",
                message: err.message
            });
            return;
        }
        res.render("index", {
            title: config.title,
            hostname: config.hostname,
            pageTitle: "",
            page: "/message",
            doc: doc
        });
    });
}


function serveMessageJSON(req, res){
    var message = (req.params.message || "").trim();

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

function serveMessageRaw(req, res){
    var message = (req.params.message || "").trim();

    api.loadRawMessage(message, function(err, raw){
        if(err){
            console.log("WEB Error Message Raw for " + message);
            console.log(err);
            res.set('Content-Type', "text/plain");
            res.send(500, err.message);
            return;
        }
        res.set('Content-Type', "text/plain");
        res.send(raw && raw.length && raw || "Error: Selected message not found - message is either expired or deleted");
    });
}

function serveMessageHTML(req, res){
    var message = (req.params.message || "").trim();

    api.loadMessage(message, function(err, doc){
        if(err){
            console.log("WEB Error Message JSON for " + message);
            console.log(err);
            res.set('Content-Type', "text/plain; Charset=utf-8");
            res.send(500, err.message);
            return;
        }

        var base = req.protocol + '://' + req.host + "/",
            html = doc?doc.html || "":"<strong>Error: Selected message not found - message is either expired or deleted</strong>";

        if(!html.match(/<head\b[^>]*>/i)){
            html = "<!DOCTYPE html><html><head><base href=\""+base+"\" target=\"_top\"/><meta charset=\"utf-8\"><link rel=\"stylesheet\" href=\"/style/iframe.css\" /></head><body>" + html + "</body></html>";
        }else{
            html = html.replace(/(<head\b[^>]*>)/i, "$1\n<base href=\""+base+"\" target=\"_top\"/><meta charset=\"utf-8\">\n");
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
        if(!attachments || !attachments[nr]){
            res.set('Content-Type', "text/plain; Charset=utf-8");
            res.send(404, "Not found");
            return;
        }
        res.set('Content-Type', attachments[nr].contentType);
        res.send(attachments[nr].content);
    });
}

function deleteMessage(req, res){
    var mailbox = (req.params.mailbox || "").toLowerCase().trim(),
        message = (req.params.message || "").trim();

    if(!mailbox.match(/@/)){
        mailbox += "@" + config.hostname;
    }

    api.deleteMessage(message, function(err, success){
        if(err){
            console.log("WEB Error Message Delete for " + message);
            console.log(err);
            res.render("index", {
                title: config.title,
                hostname: config.hostname,
                pageTitle: "",
                page: "/error",
                message: err.message
            });
            return;
        }
        res.redirect("/mailbox/"+encodeURIComponent(mailbox)+"?message=deleted");
    });
}


function uploadMessage(req, res){
    var mailbox = (req.params.mailbox || "").toLowerCase().trim();
    if(!req.files || !req.files.eml || !req.files.eml.size){
        res.redirect("/mailbox/"+encodeURIComponent(mailbox)+"?error=missing-file");
    }else if(req.files.eml.size > config.smtp.maxSize){
        res.redirect("/mailbox/"+encodeURIComponent(mailbox)+"?error=too-large-file");
    }else{
        fs.readFile(req.files.eml.path, function(err, body){
            fs.unlink(req.files.eml.path);
            if(err){
                console.log("WEB Error Message upload for " + message);
                console.log(err);
                res.set('Content-Type', "text/plain; Charset=utf-8");
                res.send(500, err.message);
                return;
            }
            api.storeRawMessage(mailbox, mailbox, body, function(err, mid){
                if(err){
                    console.log("WEB Error Message upload for " + message);
                    console.log(err);
                    res.set('Content-Type', "text/plain; Charset=utf-8");
                    res.send(500, err.message);
                    return;
                }
                if(mid){
                    res.redirect("/mailbox/"+encodeURIComponent(mailbox)+"?message=uploaded&mid="+mid);
                }else{
                    res.set('Content-Type', "text/plain; Charset=utf-8");
                    res.send(500, "Upload failed for reasons not so well known");
                }
            });
        });
        return;
    }

    if(req.files && req.files.eml && req.files.eml.path){
        fs.unlink(req.files.eml.path);
    }
}