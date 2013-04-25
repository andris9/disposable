# disposable

Web app for creating your own hassle free disposable mailbox service like Mailinator or TrashMail.

## DEMO

Demo app can be seen at [disposebox.com](http://disposebox.com)

## Setup DNS

Before you can receive any e-mails you need to set up at least one MX record for your domain.

For example if you want to receive e-mails for `usename@example.com` and the hostname of the actual server where the SMTP daemon is running is `smtp.example.com` then you need to set up the following MX record:

  * host: **example.com** (derives from username@ `example.com`, most DNS admin interfaces allow or require to use `@` as the host placeholder, some do not allow you to set this value by yourself at all)
  * priority: **10** (any positive number is ok - if multiple MX servers are listed, the one with the lower number is preferred when connecting)
  * mx/hostname/points to: **smtp.example.com** (hostname or IP where the SMTP daemon is running)

You can check if the record is correct with the `dig` command - be patient though when checking, since DNS propagation usually takes some time.

    > dig MX example.com
    ...
    ;; ANSWER SECTION:
    example.com.    3600    IN  MX  10 smtp.example.com.

## Installation

### Requiremenets

  * **Node.js** (min v0.8)
  * **MongoDB** (min. v2.2)

### Install

    cd /path/to/install
    git clone git://github.com/andris9/disposable.git
    cd disposable
    npm install
    cp config/development.json config/production.json

Edit the values in `config/production.json` - you probably want to keep everything except `hostname` and `title` and probably `loggerInterface` (set to an empty string to get more conventional logging, see all available options for the logger [here](http://www.senchalabs.org/connect/logger.html)).

### Pre run

Check that nothing is already using port 25. Usually there might me a sendmail daemon or such already installed. Try to connect to localhost port 25 and if you receive an answer uninstall or kill the task that is using this port.

### Run

Run from the console

    sudo NODE_ENV=production node index.js

Or alternatively add an init script (you can tail the log file from /var/log/disposable.log)

    cd /etc/init.d
    sudo ln -s /path/to/disposable/setup/disposable
    service disposable start

**NB!** the app needs to be run as root - there are ports under 1000 to bind. Root privileges are released shortly after binding the ports though.

You can also setup a monit script to ensure that the app keeps runnings

    cd /path/to/monit/conf.d/
    sudo ln -s /path/to/disposable/setup/disposable.monit
    sudo service monit restart

To ensure that the app runs on reboot you can add it to startup list

In CentOS

    sudo chkconfig disposable on

In Ubuntu

    sudo update-rc.d disposable defaults

## License

**MIT**
