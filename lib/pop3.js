var config = require("../config/" + (process.env.NODE_ENV || "development") + ".json"),
    N3 = require("pop3-n3").N3,
    api = require("./api");

module.exports.listen = function(callback){
	N3.startServer(110, config.hostname, AuthStore, MessageStore, callback);
}

function AuthStore(user, auth){
	// report username as the password
    return auth(user);
}

function MessageStore(user){
    this.user = (user || "").toString().toLowerCase().trim();
    var curtime = new Date().toLocaleString();
    this.messages = [];
    this.size = 0;
    this.length = 0;
    this.loaded = false;
}

MessageStore.prototype.stat = function(callback){
    if(this.loaded){
        return callback(null, this.length, this.size);
    }

    this.size = 0;
    this.length = 0;

    api.loadMailbox(this.user, (function(err, docs){
    	if(err){
    		console.log("POP3 Error: STAT for " + this.user);
    		console.log(err);
    		return callback(err);
    	}

    	// force to an array
    	docs = [].concat(docs || []);

        this.messages = docs.map((function(elm){
            this.size += elm.rawsize || 0;
            this.length ++;
            return {
                uid: (elm._id || "").toString(),
                deleteFlag: false,
                size: elm.rawsize || 0
            };
        }).bind(this));
        
        this.loaded = true;
        
        return callback(null, this.length, this.size);

    }).bind(this));
}

MessageStore.prototype.list = function(msg, callback){
    if(!this.loaded){
        return this.stat((function(){
            if(!this.loaded){
            	console.log("POP3 Error: LIST for " + this.user);
    			console.log("Failed listing messages");
                return callback(new Error("Failed"));
            }
            this.list(msg, callback);
        }).bind(this));
    }

    var result = [];
    if(msg){
        if(isNaN(msg) || msg<1 || msg>this.messages.length || 
                                this.messages[msg-1].deleteFlag)
            callback(null, false);
        return msg+" "+this.messages[msg-1].size;
    }
    for(var i=0, len = this.messages.length;i<len;i++){
        if(!this.messages[i].deleteFlag)
            result.push((i+1)+" "+this.messages[i].size)
    }
    callback(null, result);
}

MessageStore.prototype.uidl = function(msg, callback){
    if(!this.loaded){
        return this.stat((function(){
            if(!this.loaded){
            	console.log("POP3 Error: UIDL for " + this.user);
    			console.log("Failed listing messages");
                return callback(new Error("Failed"));
            }
            this.list(msg, callback);
        }).bind(this));
    }

    var result = [];
    if(msg){
        if(isNaN(msg) || msg<1 || msg>this.messages.length || 
                                this.messages[msg-1].deleteFlag)
            callback(null, false);
        callback(null, msg+" "+this.messages[msg-1].uid);
    }
    for(var i=0, len = this.messages.length;i<len;i++){
        if(!this.messages[i].deleteFlag)
            result.push((i+1)+" "+this.messages[i].uid)
    }
    callback(null, result);
}

MessageStore.prototype.retr = function(msg, callback){
    if(!this.loaded){
        return this.stat((function(){
            if(!this.loaded){
            	console.log("POP3 Error: RETR for " + this.user);
    			console.log("Failed listing messages");
                return callback(new Error("Failed"));
            }
            this.list(msg, callback);
        }).bind(this));
    }

    if(!msg || isNaN(msg) || msg<1 || msg>this.messages.length || 
                                this.messages[msg-1].deleteFlag)
        return callback(null, false);

    api.loadRawMessage(this.messages[msg-1].uid, (function(err, message){
    	if(err){
    		console.log("POP3 Error: RETR for " + this.user);
    		console.log(err);
            return callback(err);
        }
        if(!message){
            return callback(null, false);
        }
        return callback(null, message);
    }).bind(this));
}

MessageStore.prototype.dele = function(msg, callback){
    if(!this.loaded){
        return this.stat((function(){
            if(!this.loaded){
            	console.log("POP3 Error: DELE for " + this.user);
    			console.log("Failed listing messages");
                return callback(new Error("Failed"));
            }
            this.list(msg, callback);
        }).bind(this));
    }

    if(!msg || isNaN(msg) || msg<1 || msg>this.messages.length || 
                                this.messages[msg-1].deleteFlag)
        return callback(null, false);
    this.messages[msg-1].deleteFlag = true;
    this.length--;
    this.size -= this.messages[msg-1].size;
    return callback(null, true);
}

MessageStore.prototype.rset = function(){
    for(var i=0, len = this.messages.length; i<len;i++){
        if(this.messages[i].deleteFlag){
            this.messages[i].deleteFlag = false;
            this.length++;
            this.size += this.messages[i].size;
        }
    }
}

MessageStore.prototype.removeDeleted = function(){
	var i=0,
		deleteMessages = ((function(err){
			if(err){
				console.log(err);
			}
			if(i>=this.messages.length){
				return;
			}
			var message = this.messages[i];
			if(!message || !message.deleteFlag){
				return process.nextTick(deleteMessages);
			}
			api.deleteMessage(message.uid, deleteMessages);
		}).bind(this));

	deleteMessages();
}