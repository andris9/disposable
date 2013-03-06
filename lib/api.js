var config = require("../config/" + (process.env.NODE_ENV || "development") + ".json"),
	MailParser = require("mailparser").MailParser,
	indentText = require("mailpurify").indentText,
	zlib = require('zlib'),
	Stream = require("stream").Stream,
	ObjectID = require('mongodb').ObjectID,
	mongodb = require("mongodb"),
    mongoserver = new mongodb.Server(config.mongo.host, config.mongo.port || 27017, {auto_reconnect: true}),
    db_connector = new mongodb.Db(config.mongo.name, mongoserver, {safe: false}),
    dbObj,
    moment = require("moment");

module.exports.initDB = initDB;
module.exports.loadMailbox = loadMailbox;
module.exports.loadMessage = loadMessage;
module.exports.loadRawMessage = loadRawMessage;
module.exports.storeRawMessage = storeRawMessage;
module.exports.deleteMessage = deleteMessage;

function initDB(callback){
	db_connector.open(function(err, db){
	    if(err){
	        return callback(err);
	    }
	    dbObj = db;
	    
	    db.ensureIndex(config.mongo.collection, {received: -1}, { expireAfterSeconds: config.mongo.ttl }, function(err){
	    	if(err){
		        return callback(err);
		    }
		    db.ensureIndex(config.mongo.collection, {mailbox: 1}, function(err){
		    	if(err){
			        return callback(err);
			    }
			    return callback(null, db);
		    });
	    });
	});
}

function storeRawMessage(mailbox, envelope, rawMessage, callback){
	var mailparser = new MailParser({showAttachmentLinks: true});
	mailparser.on("end", function(message){
		indentText(message.text || "", function(err, textHTML){
			message.html = message.html || textHTML;
			if(message.attachments){
	            for(var i=0, len = message.attachments.length; i<len; i++){
	                message.attachments[i].content = message.attachments[i].content.toString("base64");
	            }
	        }

	        rawMessage = Buffer.concat([
	        	new Buffer("Delivered-To: "+((mailbox || envelope.to || "").toLowerCase().trim())+"\r\n", "utf-8"),
	        	rawMessage]);

	    	storeMessage(mailbox, envelope, rawMessage, message, callback);
		});
	});
	mailparser.end(rawMessage);
}

function storeMessage(mailbox, envelope, rawMessage, message, callback){
	 var data = {
        received: new Date(),
        from: envelope.from,
        read: false,
        mailbox: (mailbox || envelope.to || "").toLowerCase().trim(),
        message: message
    };

    zlib.gzip(rawMessage, function(err, buffer) {
        if (!err && buffer) {
            data.raw = buffer.toString("base64");
            data.rawsize = rawMessage.length;
        }else{
            data.raw = "";
            data.rawsize = 0;
        }

        dbObj.collection(config.mongo.collection, function(err, collection){
            if(err){
                return callback(err);
            }
            collection.insert(data, {safe: true}, function(err, records){
            	if(err){
            		return callback(err);
            	}
                if(records && records.length){
                	return callback(null, records[0]._id);
                }
                return callback(null, false);
            });
    	});    
    });
}

function loadMailbox(mailbox, callback){
	dbObj.collection(config.mongo.collection, function(err, collection){
        if(err){
            return callback(err);
        }
        collection.find({mailbox: mailbox},
          {from: true, mailbox: true, "message.subject": true, read:true, received: true, "message.from": true},
          {sort: [["received", "desc"]], limit: config.mailbox.maxMessages}).toArray(function(err, docs){
            if(err){
                return callback(err);
            }
            docs.forEach(function(elm){
                elm.relativeDate = moment(elm.received).fromNow();
                elm.subject = elm.message.subject || "";
                elm.displayDate = moment(elm.received).format(config.mailbox.dateFormat);
                elm.fromAddress = elm.message.from && elm.message.from[0] || {address: elm.from};
                elm.fromAddress.name = elm.fromAddress.name || elm.fromAddress.address
                elm.fromAddress = elm.fromAddress.name != elm.fromAddress.address ? elm.fromAddress.name+" <" + elm.fromAddress.address + ">" : elm.fromAddress.name
            });
            return callback(docs);
        });
    });
}

function loadMessage(messageId, callback){
	dbObj.collection(config.mongo.collection, function(err, collection){
        if(err){
            return callback(err);
        }
        collection.findOne({_id: new ObjectID(messageId)}, 
          {raw: false},
          {}, function(err, elm){
            if(err){
                return callback(err);
            }
            if(!elm){
                return callback(err, false);
            }

            elm.message.id = (elm._id || "").toString();
            elm.relativeDate = moment(elm.received).fromNow();
            elm.subject = elm.message.subject || "";
            elm.mailbox = elm.mailbox || "";
            elm.displayDate = moment(elm.received).format(config.mailbox.dateFormat);
            elm.fromAddress = elm.message.from && elm.message.from[0] || {address: elm.from};
            elm.fromAddress.name = elm.fromAddress.name || elm.fromAddress.address
            elm.fromAddress = elm.fromAddress.name != elm.fromAddress.address ? elm.fromAddress.name+" <" + elm.fromAddress.address + ">" : elm.fromAddress.name

            if(!elm.read){
                collection.update({_id: new ObjectID(messageId)}, {$set: {read:true}});
            }

            if(elm.message.attachments){
                elm.message.attachments.forEach(function(attachment, i){
                    attachment.i = i;
                })
            }
            
            elm.message.html = (elm.message.html || "").replace(/(\s(?:src|href)\s*=\s*['"])(?:cid:)([^'"\s]+)/ig, function(o, prefix, cid){
                if(elm.message.attachments){
                    for(var i=0, len = elm.message.attachments.length; i<len; i++){
                        if(elm.message.attachments[i].contentId == cid){
                            return prefix + cofig.urlprefix + "/attachment/"+req.params.message+"/"+i+"/" + elm.message.attachments[i].generatedFileName.replace(/</g,"&lt;").replace(/>/g,"&gt;");
                        }
                    }
                }    
                return prefix+"cid:"+cid;
            });


            elm.message.html = elm.message.html.replace(/\r?\n|\r/g, "\u0000").
                replace(/<script\b[^>]*>.*<\/script\b[^>]*>/ig, " ").
                replace(/\bon[a-z]{3,}\s*=/gi, "").
                replace(/\u0000/g, "\n").trim();

            return callback(elm);
        });
    });
}

function loadRawMessage(messageId, callback){
	dbObj.collection(config.mongo.collection, function(err, collection){
        if(err){
            return callback(err);
        }
        collection.findOne({_id: new ObjectID(messageId)}, 
          {raw: true},
          {}, function(err, elm){
            if(err){
                return callback(err);
            }
            if(!elm){
                return callback(null, false);
            }

            zlib.gunzip(new Buffer(elm.raw || "", "base64"), function(err, buffer) {
                if(err){
                    return callback(err);
                }
                return callback(null, buffer);
            });
        });
    });
}

function deleteMessage(messageId, callback){
	dbObj.collection(config.mongo.collection, function(err, collection){
        if(err){
            return callback(err);
        }
        collection.remove({_id: new ObjectID(messageId)}, function(err){
            if(err){
            	return callback(err);
            }
            return callback(null, true);
        });
    });
}