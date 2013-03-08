var api = require("./lib/api"),
    web = require("./lib/web"),
    smtp = require("./lib/smtp"),
    pop3 = require("./lib/pop3"),
    ready = 0;

api.initDB(function(err){
    if(err){
        throw err;
    }

    web.listen(listener.bind(this, "Web"));
    smtp.listen(listener.bind(this, "SMTP"));
    pop3.listen(listener.bind(this, "POP3"));
});

function listener(service, error){
    if(error){
        console.log("Starting " + service + " server failed for the following error:");
        console.log(error);
        return process.exit(1);
    }
    console.log(service + " server started successfully");
    ready++;

    if(ready == 3){
        ready++;
        console.log("All servers started, downgrading from root to nobody");
        process.setgid("nobody");
        process.setuid("nobody");
    }
}