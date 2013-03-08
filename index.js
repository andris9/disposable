var config = require("./config/" + (process.env.NODE_ENV || "development") + ".json"),
    cluster = require('cluster'),
    numCPUs = config.workerCount || require('os').cpus().length;

if(cluster.isMaster){

    // check if you need root rights
    checkPrivilegedPorts();

    console.log("Starting Disposable server");

    // Fork workers.
    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', function(worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' died, restarting');
        cluster.fork();
    });

    // Handle error conditions
    process.on("SIGTERM", function(){
        console.log("Exited on SIGTERM");
        process.exit(0);
    });

    process.on("SIGINT", function(){
        console.log("Exited on SIGINT");
        process.exit(0);
    });

}else{
    console.log("Starting worker "+process.pid);
    require("./server");
}

process.on('uncaughtException', function(err) {
    console.log("uncaughtException");
    console.log(err.stack);
    process.exit(1);
});

function checkPrivilegedPorts(){
    var privilegedPorts = [];

    if(config.smtp.port < 1000){
        privilegedPorts.push(config.smtp.port);
    }
    if(config.web.port < 1000){
        privilegedPorts.push(config.web.port);
    }
    if(config.pop3.port < 1000){
        privilegedPorts.push(config.pop3.port);
    }
    if(!privilegedPorts.length){
        return;
    }

    privilegedPorts.sort(function(a,b){
        return a-b;
    });

    if(process.getgid() || process.getuid()){
        console.log("");
        console.log("Error starting the app");
        console.log("======================");
        console.log("You need to run this app as root user to be able to bind to ports " + privilegedPorts.join(", "));
        console.log("Don't worry, root privileges are released shortly after binding");
        console.log("");
        process.exit(2);
    }
}