var config = require("./config/" + (process.env.NODE_ENV || "development") + ".json"),
    cluster = require('cluster'),
    numCPUs = config.workerCount || require('os').cpus().length;

if(cluster.isMaster){

    console.log("Starting Disposable server")

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
    console.log(err.stack)
    process.exit(1);
});