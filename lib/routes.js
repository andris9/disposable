var config = require("../config/" + (process.env.NODE_ENV || "development") + ".json"),
    api = require("./api"),
    crypto = require("crypto"),
    fs = require("fs");

// Main router function
module.exports = function(app){
    app.get("/", serveFrontpage);
    app.get('/about', serveAbout);
    app.post('/redir', serveRedirect);
    app.get('/mailbox/:mailbox/json', serveMailboxJSON);
    app.get('/mailbox/:mailbox/rss', serveMailboxRSS);
    app.get('/message/:message/json', serveMessageJSON);
    app.get('/message/:message/html', serveMessageHTML);
    app.get('/message/:message/text', serveMessagePlain);
    app.get('/message/:message/eml', serveMessageRaw);
    app.get('/attachment/:message/:nr/:filename', serveAttachment);
    app.get('/mailbox/:mailbox', serveMailbox);
    app.get('/message/:message', serveMessage);
    app.get('/delete/:mailbox/:message', deleteMessage);
    app.post('/mailbox/:mailbox/upload', uploadMessage);
};

/**
 * Serves frontpage (/) of the website
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
function serveFrontpage(req, res){
    res.setHeader("Content-Type", "text/html");
    res.render("index", {
        title: config.title,
        hostname: config.hostname,
        pageTitle: false,
        page: "/"
    });
}

/**
 * Serves about page (/about) of the website
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
function serveAbout(req, res){
    res.setHeader("Content-Type", "text/html");
    res.render("index", {
        title: config.title,
        hostname: config.hostname,
        pageTitle: "About",
        page: "/about"
    });
}

/**
 * Redirects frontpage form to an actual mailbox URL
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
function serveRedirect(req, res){
    var mailbox = (req.body.mailbox || "").toString().trim().toLowerCase() ||
        (crypto.randomBytes(4).toString("hex") + "@" + config.hostname);

        if(!mailbox.match(/@/)){
            mailbox += "@" + config.hostname;
        }

    return res.redirect("/mailbox/" + encodeURIComponent(mailbox));
}

/**
 * Serves a selected mailbox page with a table of received messages
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
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

/**
 * Serves a selected mailbox in the form of a JSON string
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
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

/**
 * Serves a selected mailbox in the form of a RSS feed
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
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

/**
 * Serves a selected message page
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
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

/**
 * Serves a selected message in the form of a JSON string
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
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

/**
 * Serves a selected message in the RFC2822 format
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
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

/**
 * Serves a selected message as a standalone HTML page (displayed in an iframe)
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
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

/**
 * Serves plaintext property of a selected message as a standalone HTML page (displayed in an iframe)
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
function serveMessagePlain(req, res){
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
            text = doc?doc.text || "":"Error: Selected message not found - message is either expired or deleted",
            html = "<p>" + text.replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/([ \t]*\r?\n){2,}/g,"</p><p>").replace(/[ \t]*\r?\n[ \t]*/g,"<br />\n") + "</p>";

        html = "<!DOCTYPE html><html><head><base href=\""+base+"\" target=\"_top\"/><meta charset=\"utf-8\"><link rel=\"stylesheet\" href=\"/style/plaintext.css\" /></head><body>" + html + "</body></html>";

        res.send(html);
    });
}

/**
 * Serves a an attachment for a message
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
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

/**
 * Handles delete request for a message and redirects accordingly
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
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

/**
 * Handles a POST request for uploading a RFC2822 message source to the selected mailbox
 *
 * @param {Object} req HTTP Request object
 * @param {Object} req HTTP Response object
 */
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
                console.log("WEB Error Message upload for " + mailbox);
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
            api.storeRawMessage(mailbox, mailbox, body, function(err, mid){
                if(err){
                    console.log("WEB Error Message upload for " + mailbox);
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