# disposable

Web app for creating hassle free disposable mailboxes

## DEMO

Demo running this app can be seen at [disposebox.com](http://disposebox.com)

## Installation

### Requiremenets

  * **Node.js**
  * **MongoDB**

### Install

    cd /path/to/install
    git clone git://github.com/andris9/disposable.git
    cd disposable
    npm install
    cp config/development.json config/production.json

Edit the values in `config/production.json` - you probably want to keep everything except `hostname` and `title` and probably `loggerInterface` (set to ans empty string to get more conventional logging).

### Run

    sudo NODE_ENV=production node index.js

Or alternatively add an init script

    cd /etc/init.d
    sudo ln -s /path/to/disposable/setup/disposable
    service disposable start

**NB!** the app needs to be run as root - there are ports under 1000 to bind. Root privileges are released shortly after binding the ports though.

You can also setup a monit script to ensure that the app keeps runnings

    cd /path/to/monit/conf
    sudo ln -s /path/to/disposable/setup/disposable.monit
    sudo service monit restart

To ensure that the app runs on reboot you can add it to boot list

In CentOs

    sudo chkconfig disposable on

In Ubuntu

    sudo update-rc.d disposable defaults

## License

**MIT**