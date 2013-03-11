var config = require("../config/" + (process.env.NODE_ENV || "development") + ".json"),
    N3 = require("pop3-n3").N3,
    api = require("./api");

/**
 * Starts listening POP3 port by creating a new N3 instance
 *
 * @param {Function} callback Callback function to run once the binding has been succeeded or failed
 */
module.exports.listen = function(callback){
    N3.startServer(config.pop3.port, config.hostname, AuthStore, MessageStore, callback);
};

/**
 * POP3 authentication function, always returns username as the password for an user
 *
 * @param {String} user Username
 * @param {Function} auth Authentication function to run with the password of the user
 */
function AuthStore(user, auth){
    // report username as the password
    return auth(user);
}

/**
 * POP3 message store. Handles all message listing and deleting requests
 *
 * @constructor
 * @param {String} user Authenticated username
 */
function MessageStore(user){
    this.user = (user || "").toString().toLowerCase().trim();
    if(!this.user.match(/@/)){
        this.user += "@" + config.hostname;
    }

    this.messages = [];
    this.size = 0;
    this.length = 0;
    this.loaded = false;
}

/**
 * Handles POP3 STAT command. This function is forced to run before any other
 * message related function (listing or deleting). Current message list is buffered
 * and the buffer is used for later calls. POP3 uses sequential message numbers
 * and if the message list is modified outside the POP3 session it would break the
 * protocol if the list is reloaded.
 *
 * STAT calculates message count and total size of the mailbox in bytes. Response looks
 * like the following (first number is the total number of messages and the second one
 * indicates the total size in bytes of the all messages)
 *
 *     3 12596
 *
 * @param {Function} callback Callback function to run with the mailbox data
 */
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
            this.size += elm.size || 0;
            this.length ++;
            return {
                uid: (elm.id || "").toString(),
                deleteFlag: false,
                size: elm.size || 0
            };
        }).bind(this));

        this.loaded = true;

        return callback(null, this.length, this.size);

    }).bind(this));
};

/**
 * Handles POP3 LIST command. LIST retrieves a list of message sequence numbers and message sizes in bytes.
 * Returned list looks like the following (first number is the message sequence number and the second one is its size).
 *
 *     1 1879
 *     2 6518
 *     3 4199
 *
 * This function uses always cached values (if the cache is not set yet, force run the STAT command).
 *
 * @param {Number} msg Message sequence number if a size of a specific message needs to be known.
 *                     If not set, all messages will be listed
 * @param {Function} callback Callback function with the message list
 */
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
        if(isNaN(msg) || msg<1 || msg>this.messages.length || this.messages[msg-1].deleteFlag){
            callback(null, false);
        }
        return msg+" "+this.messages[msg-1].size;
    }
    for(var i=0, len = this.messages.length;i<len;i++){
        if(!this.messages[i].deleteFlag){
            result.push((i+1)+" "+this.messages[i].size);
        }
    }
    callback(null, result);
};

/**
 * Handles POP3 UIDL command - UIDL retrieves the unique id of selected message or all messages.
 * In current case, the UIDL value stands for the message entity ID in the database.
 *
 *     1 513da6392fb024857d000005
 *     2 513d9f232fb024857d000004
 *     3 513d7ce32fb024857d000003
 *
 * This function uses always cached values (if the cache is not set yet, force run the STAT command).
 *
 * @param {Number} msg Message sequence number if an uidl value of a specific message needs to be known.
 *                     If not set, all messages will be listed
 * @param {Function} callback Callback function with the uidl list
 */
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
        if(isNaN(msg) || msg<1 || msg>this.messages.length || this.messages[msg-1].deleteFlag){
            callback(null, false);
        }
        callback(null, msg+" "+this.messages[msg-1].uid);
    }
    for(var i=0, len = this.messages.length;i<len;i++){
        if(!this.messages[i].deleteFlag){
            result.push((i+1)+" "+this.messages[i].uid);
        }
    }
    callback(null, result);
};

/**
 * Handles POP3 RETR command which is meant for retrieval of a full message
 *
 * Message sequence number is used against the cache to detect the actual ID value of the message
 *
 * @param {Number} msg Message sequence number
 * @param {Function} callback Callback function to run with the message source
 */
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

    if(!msg || isNaN(msg) || msg<1 || msg>this.messages.length || this.messages[msg-1].deleteFlag){
        return callback(null, false);
    }

    if(this.messages[msg-1].uid.length != 12 && this.messages[msg-1].uid.length != 24){
        return callback(null, false);
    }

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
};

/**
 * Handles POP3 DELE command which is meant for marking messages as deleted. Marked message
 * is not deleted yet, as the state can be reset with RSET command. Deletion usually
 * occurs on exit and is performed by removeDeleted function
 *
 * @param {Number} msg Message sequence number
 * @param {Function} callback Callback function to run
 */
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

    if(!msg || isNaN(msg) || msg<1 || msg>this.messages.length || this.messages[msg-1].deleteFlag){
        return callback(null, false);
    }
    this.messages[msg-1].deleteFlag = true;
    this.length--;
    this.size -= this.messages[msg-1].size;
    return callback(null, true);
};

/**
 * Handles POP3 RSET command which resets the state of messages marked for deletion
 */
MessageStore.prototype.rset = function(){
    for(var i=0, len = this.messages.length; i<len;i++){
        if(this.messages[i].deleteFlag){
            this.messages[i].deleteFlag = false;
            this.length++;
            this.size += this.messages[i].size;
        }
    }
};

/**
 * Removes all messages from the mailbox/databse which are marked for deletion
 */
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
};