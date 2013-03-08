# disposable

Create hassle free disposable mailboxes

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

Edit the values in `config/production.json` - you probably want to keep everything except `hostname` and `title`.

### Run

    sudo NODE_ENV=production node index.js

Or alternatively add an init script

    cd /etc/init.d
    ln -s /path/to/disposable/setup/disposable
    service disposable start

**NB!** the app needs to be run as root - there are ports under 1000 to bind. Root privileges are released shortly after binding the ports though.

## DEMO

Demo running this app can be seen at [disposebox.com](http://disposebox.com)

## License

**MIT**