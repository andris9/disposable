var config = require("../config/" + (process.env.NODE_ENV || "development") + ".json"),
    api = require("./api"),
    simplesmtp = require("simplesmtp"),

    // Define Simple SMTP server
    server = simplesmtp.createSimpleServer({
            name: config.hostname, // Hostname reported to the client
            SMTPBanner: config.smtp.banner, // Server greeting
            maxSize: config.smtp.maxSize, // Maximum allowed message size in bytes
                                          // (soft limit, reported to the client but not used in
                                          // any other way by the smtp server instance)
            ignoreTLS: true, // Do not require STARTTLS
            disableDNSValidation: true // do not validate sender DNS
        }, requestListener);

/**
 * Starts listening SMTP port
 *
 * @param {Function} callback Callback function to run once the binding has been succeeded or failed
 */
module.exports.listen = function(callback){
    server.listen(config.smtp.port, callback);
};

/**
 * SMTP session handler. Processes incoming message
 *
 * @param {Object} req SMTP request object
 */
function requestListener(req){
    var messageBodyArr = [],
        messageBodyLength = 0,
        reject = false;

    // Keep buffering incoming data until maxSize length is reached
    req.on("data", function(chunk){
        if(chunk.length + messageBodyLength <= config.smtp.maxSize){
            messageBodyArr.push(chunk);
            messageBodyLength += chunk.length;
        }else{
            reject = true;
        }
    });

    req.on("end", function(){
        // if message reached maxSize, reject it
        if(reject){
            return req.reject("Message size larger than allowed " + config.smtp.maxSize + " bytes");
        }

        var rawMessage = new Buffer(Buffer.concat(messageBodyArr, messageBodyLength).toString("binary").replace(/^\.\./mg, "."), "binary"),
            idList = [],

            // store the received message for every recipient separately
            processRecipients = function(){
                if(!req.to.length){
                    // in case of several recipients there should also be several message id values
                    req.accept(idList.join(", "));
                    return;
                }
                var recipient = req.to.shift();
                api.storeRawMessage(recipient, req.from, rawMessage, function(err, id){
                    if(err){
                        console.log("Error storing message for " + recipient);
                        console.log(err);
                    }
                    if(id){
                        idList.push(id);
                    }
                    process.nextTick(processRecipients);
                });
            };

        // store message for every recipient separately
        processRecipients();
    });
}