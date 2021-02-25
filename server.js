//Websockets stuff
var expressWs = require('express-ws');
var express = require('express');//these two are weird but ok
var app = require('express')();
const fetch = require("node-fetch");

expressWs(app);
var hpf = getDictionaryKeys();
var spacecraft = new Spacecraft();
var historyServer = new HistoryServer(spacecraft);
var realtimeServer = new RealtimeServer(spacecraft);

var iface = 'wlan0'; //name of wireless hotspot inteface
var localip = require('local-ip')(iface);
app.use('/realtime', realtimeServer);
app.use('/history', historyServer);
var myPort = process.env.PORT ||8080
app.listen(myPort, function () {	
	    console.log('Open MCT hosted at http://' + localip );
	    console.log('History hosted at http://' + localip + '/node');
	    console.log('Realtime hosted at ws://' + localip + ':' + myPort + '/realtime');
});

//Get keys from dictionary.json
function getDictionaryKeys(){
	var data = {};
	fetch("http://localhost/dictionary.json")
	.then(results => results.json())
	.then(json => {
        	Object.keys(json.measurements).forEach(key => data[json.measurements[key].key] = 0);
	});
	return data;
}

//Realtime copypaste
function RealtimeServer(spacecraft) {

    var router = express.Router();

    router.ws('/', function (ws) {
        var unlisten = spacecraft.listen(notifySubscribers);
        var subscribed = {}; // Active subscriptions for this connection
        var handlers = { // Handlers for specific requests
                subscribe: function (id) {
                    subscribed[id] = true;
                },
                unsubscribe: function (id) {
                    delete subscribed[id];
                }
            };
        function notifySubscribers(point) {
            if (subscribed[point.id]) {
                ws.send(JSON.stringify(point));
            }
        }

        // Listen for requests
        ws.on('message', function (message) {
            var parts = message.split(' '),
                handler = handlers[parts[0]];
            if (handler) {
                handler.apply(handlers, parts.slice(1));
            }
        });

        // Stop sending telemetry updates for this connection when closed
        ws.on('close', unlisten);
    });

    return router;
};

function Spacecraft() {
	this.state = hpf;
	this.history = {};
	this.listeners = [];
	       Object.keys(hpf).forEach(function (k) {
	       this.history[k] = [];
	    }, this);

	 setInterval(function () {
            this.updateState();
 	 }.bind(this), 1000);
};


Spacecraft.prototype.updateState = function () {
	var keys = Object.keys(hpf);
	var timestamp = Date.now();
	for(var key of keys){
		var state = {timestamp: timestamp, value: hpf[key], id: key};
		this.notify(state);
                if (this.history[key] === undefined) {
                    this.history[key] = [];
                }
	        this.history[key].push(state);
	}
}

Spacecraft.prototype.notify = function (point) {
    this.listeners.forEach(listener => {
            listener(point);
        });
};

Spacecraft.prototype.listen = function (listener) {
    this.listeners.push(listener);
    return function () {
           this.listeners = this.listeners.filter(function (l) {
               return l !== listener;
            });
     }.bind(this);
};

//History copypaste
function HistoryServer(spacecraft) {
    var router = express.Router();
    router.get('/:pointId', function (req, res) {
        var start = +req.query.start;
        var end = +req.query.end;
        var ids = req.params.pointId.split(',');

        var response = ids.reduce(function (resp, id) {
            return resp.concat(spacecraft.history[id].filter(function (p) {
                return p.timestamp > start && p.timestamp < end;
            }));
        }, []);
        res.status(200).json(response).end();
    });

    return router;
}

//Serialport stuff
var SerialPort = require('serialport');
var port = new SerialPort('/dev/ttyUSB0', {
        baudRate: 230400
});
var txData = new Uint8Array(1000);
const InterByteTimeout = require('@serialport/parser-inter-byte-timeout')
const Delimiter = require('@serialport/parser-delimiter')
const parser = port.pipe(new InterByteTimeout({interval: 30}))
parser.on('data', readAndSort) // will emit data if there is a pause between packets of at least 30ms

function  readAndSort(txData)
{
	if(txData[0] == 0x7E)
	{
		//If msg with can data
		 if(txData[1] || (txData[2] != 0x0C))
		{
			commonTxMsg(txData);	
		}
		//If bootup sequence, AT command response etc.
		else if(0)
		{
			dbATresponse(txData);
		}
	}
}

function commonTxMsg(txData)
{
	var idplacement = 15;
	var arrLength = (txData[1] << 8 | txData[2] )+0x03; //Array length starting from 0
 	var dataLength = arrLength-idplacement;
	/*To add or remove elements use theCascadinator function
	 * theCascadinator(arrayelementstart,array,multiply by,element size)
	 * and use the decimal value of the CAN ID you are interested in for the case statement.
	 * The cascadinator cascades X amount of array elements from array element Y,
	 * then formats them according to the number chosen to multiply with. */
	while(dataLength)	
	{
	        switch((txData[idplacement] << 8 | txData[idplacement+1]))
		{
                case(0x9):
			hpf.bsmr = txData[idplacement+3];
			hpf.maxtemp = txData[idplacement+4]*0.390625;
			hpf.bmspreflag = txData[idplacement+5];
			hpf.opmode = txData[idplacement+6];
			hpf.mcid = txData[idplacement+7];
			hpf.mincellvolt = theCascadinator(idplacement+8,txData,1,2);
               		break;
		case(0xA):
			hpf.pecerr = theCascadinator(idplacement+3, txData, 1, 4);
			hpf.pecs = theCascadinator(idplacement+3, txData, 1,4);
			break;
		case(0xB):
			hpf.bmsv = theCascadinator(idplacement+3, txData, 10, 4);
			break;
		case(0x1A):
			hpf.btr = theCascadinator(idplacement+3,txData,0.1,2);
			hpf.btl = theCascadinator(idplacement+9,txData,0.1,2);
			hpf.susprl = txData[idplacement+5];
			hpf.susprr = txData[idplacement+6];
			hpf.suspfr = txData[idplacement+7];
			hpf.suspfl = txData[idplacement+8];
			break;
 		case(0x20):
			hpf.ecu0 = txData[idplacement+3];
			hpf.ecu1 = txData[idplacement+4];
			hpf.ecu2 = txData[idplacement+5];
			hpf.ecu3 = txData[idplacement+6];
			hpf.ecu4 = txData[idplacement+7];
			hpf.ecu5 = txData[idplacement+8];
			hpf.ecu6 = txData[idplacement+9];
			hpf.ecu7 = txData[idplacement+10];
			break;
		case(0x101):
			hpf.linv = txData[idplacement+3];
			hpf.rinv = txData[idplacement+5];
			break;
		case(0x121):
			hpf.accelx = theCascadinator(idplacement+3, txData, 0.01,2);
			hpf.accely = theCascadinator(idplacement+5, txData, 0.01,2);
			hpf.accelz = theCascadinator(idplacement+7, txData, 0.01,2);
			break;
		case(0x122):
			hpf.ratx = theCascadinator(idplacement+3, txData, 0.001,2);
			hpf.raty = theCascadinator(idplacement+5, txData, 0.001,2);
			hpf.ratz = theCascadinator(idplacement+7, txData, 0.001,2);
			break;
		case(0x123):
			hpf.dvelx = theCascadinator(idplacement+3, txData, 0.01,2);
			hpf.dvely = theCascadinator(idplacement+5, txData, 0.01,2);
			hpf.dvelz = theCascadinator(idplacement+7, txData, 0.01,2);
			break;
		case(0x132):
			hpf.rangle = theCascadinator(idplacement+3, txData, 0.0001,2);
			hpf.pangle = theCascadinator(idplacement+5, txData, 0.0001,2);
			hpf.yangle = theCascadinator(idplacement+7, txData, 0.0001,2);
			break;
		case(0x139):
			hpf.velx = theCascadinator(idplacement+3, txData, 0.01,2);
			hpf.vely = theCascadinator(idplacement+5, txData, 0.01,2);
			hpf.velz = theCascadinator(idplacement+7, txData, 0.01,2);
			break;
		case(0x1F0):
			hpf.renc = theCascadinator(idplacement+3, txData, 1, 4);
        		break;
		case(0x1F1):
			hpf.lenc = theCascadinator(idplacement+3, txData, 1, 4);
			break;
		case(0x220):
			hpf.anglet = theCascadinator(idplacement+3, txData, 0.0001, 2);
			hpf.angles = theCascadinator(idplacement+5, txData, 0.0001, 2);
			hpf.curvrad = theCascadinator(idplacement+7, txData, 0.001, 2);
			break;
		case(0x520):
			hpf.tsalair = txData[datapoints+6]*0.197692;
			hpf.lvvolt = txData[datapoints+7]*0.1216;
			hpf.lvcurr = txData[datapoints+8];
			break;
		case(0x521):
			hpf.accucurr = theCascadinator(idplacement+6, txData, 0.001,3);
			break;
		case(0x522):
			hpf.accuvolt = theCascadinator(idplacement+6, txData, 0.001,3);
			break;
		case(0x523):
			hpf.invvvolt = theCascadinator(idplacement+6, txData, 0.001,3);
			break;
		case(0x526):
			hpf.power = theCascadinator(idplacement+6, txData, 1,3);
			break;
		case(0x528):
			hpf.energy = theCascadinator(idplacement+6, txData, 0.001,3);
			break;
		case(0x7C6):
			hpf.lefttrqreq = theCascadinator(idplacement+3, txData, 0.065,2);
			hpf.righttrqreq = theCascadinator(idplacement+5, txData, 0.065,2);
			hpf.frontbp = theCascadinator(idplacement+7, txData, 1,2);
			hpf.rearbp = theCascadinator(idplacement+9, txData, 1,2);
			break;
		case(0x7C7):
			hpf.rightinvsp = theCascadinator(idplacement+3, txData, 1,4);
			hpf.leftinvsp = theCascadinator(idplacement+7, txData, 1,4);
			break;
		case(0x7C8):
			hpf.temp = txData[idplacement+3];
			hpf.maxtorq = txData[idplacement+4];
			hpf.lefttrqperc = theCascadinator(idplacement+7, txData, 1,2);
			hpf.righttrqperc = theCascadinator(idplacement+9, txData, 1,2);
			break;
		default:
               		break;
        }

		dataLength -= txData[idplacement+2]+3;
		idplacement += txData[idplacement+2]+3;
	
	}
	
}
function dbATresponse(txData)
{
	return 0;
}
//Cascades set amount of elements and multiplies them by some format
function theCascadinator(x,txData,form,size)
{
	
	var result = 0;
	var shift = (size-1)*8;
	for(var i = 0; i<size;i++)
	{
		result += (txData[i+x] << (shift-i*8));	
	}
	return (result * form);	
}
