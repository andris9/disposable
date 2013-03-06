var config = require("../config/" + (process.env.NODE_ENV || "development") + ".json"),
	api = require("./api"),
	simplesmtp = require("simplesmtp"),
	server = simplesmtp.createSimpleServer({
			name: config.smtp.domain,
		    SMTPBanner: config.smtp.banner,
		    maxSize: config.smtp.maxSize,
		    ignoreTLS: true,
		    disableDNSValidation: true
		}, requestListener);

module.exports.listen = function(callback){
	server.listen(config.smtp.port, callback);
}

function requestListener(req){
	var messageBodyArr = [],
		messageBodyLength = 0,
		reject = false;

	req.on("data", function(chunk){
		if(chunk.length + messageBodyLength <= config.smtp.maxSize){
			messageBodyArr.push(chunk);
			messageBodyLength += chunk.length;
		}else{
			reject = true;
		}
	});

	req.on("end", function(){
		if(reject){
			return req.reject("Message size larger than allowed " + config.smtp.maxSize + " bytes");
		}
		
		var rawMessage = Buffer.concat(messageBodyArr, messageBodyLength),
			idList = [],
			processRecipients = function(){
				if(!req.to.length){
					req.accept(idList.join(", "))
					return;
				}
				var recipient = req.to.shift();
				api.storeRawMessage(recipient, {from: req.from, to: recipient}, rawMessage, function(err, id){
					if(err){
						console.log("Error storing message for " + recipient);
						console.log(err);
					}
					if(id){
						idList.push(id);
					}
					process.nextTick(processRecipients);
				});
			}

		processRecipients();
	});
}