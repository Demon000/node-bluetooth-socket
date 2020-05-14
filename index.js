const stream = require('stream');
const ErrNo = require('errno')
const BluetoothFd = require('./build/Release/BluetoothFd.node');

class BluetoothSocket extends stream.Duplex {

    constructor(fd, options) {
        super(options);

        this._impl = new BluetoothFd(fd, this.onRead.bind(this));
    }

    _write(chunk, encoding, callback) {
        if (encoding !== 'buffer')
            chunk = Buffer.from(chunk, encoding);
        const ret = this._impl.write(chunk);

        let err = null;
        if (ret !== 0) {
            const errDesc = ErrNo.errno[ret] || {};
            const err = new Error(errDesc.description || "Code "+ret);
            err.name = "SystemError";
            err.syscall = "read";
            err.errno = ret;
            err.code = errDesc.code;
        }
        callback(err);
    }

    _read(size) {
        this._impl.start();
    }

    onRead(errno, buf) {
        if (errno !== 0) {
            //TODO emit close event
            if(errno === 103/*ECONNABORTED*/) {
                this._impl.stop();
                this.push(null);
                return;
            }

            const errDesc = ErrNo.errno[errno] || {};
            const err = new Error(errDesc.description || "Code "+errno);
            err.name = "SystemError";
            err.syscall = "read";
            err.errno = errno;
            err.code = errDesc.code;

            process.nextTick(() => this.emit('error', err));
            return;
        }
        if (!this.push(buf)) {
            this._impl.stop();
        }
    }

    _destroy(err, cb) {
        return this._close(cb);
    }

    _final(cb) {
        return this._close(cb);
    }

    _close(cb) {
        try {
            this._impl.close();
        } catch (e) {
            return cb && cb(e);
        }
        cb && cb();
    }
}

module.exports = BluetoothSocket;