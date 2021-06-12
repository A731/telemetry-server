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

var iface = 'eth0'; //name of wireless hotspot inteface
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
	fetch("http://localhost/dictionary.json") //Change localhost to IP address of device
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
		case(0x8):
			hpf.Uptime = theCascadinator(idplacement+3,txData,1,4);
			hpf.Opmode = theCascadinator(idplacement+8,txData,1,1);
			hpf.Reason = txData[idplacement+9];
			hpf.Precharge_Flag = txData[idplacement+10];
			hpf.Air_Flag = txData[idplacement+11];
			break;
		case(0x9):
			hpf.Pec_Total = theCascadinator(idplacement+3, txData, 1, 4);
			hpf.Pec_Delta = theCascadinator(idplacement+3, txData, 1,4);
			break;
		case(0xA):
			hpf.Accumulator_Voltage = theCascadinator(idplacement+3, txData, 1, 4);
			hpf.Voltage_Min = txData[idplacement+4];
			hpf.Voltage_Max = txData[idplacement+5];
			hpf.Temperature_Max = txData[idplacement+6];
			break;
		case(0x521):
			hpf.IVT_Current = theCascadinator(idplacement+6, txData,0.001,4);
			break;
		case(0x522):
			hpf.IVT_Voltage1 = theCascadinator(idplacement+6, txData,0.001,4);
			break;
		case(0x523):
			hpf.IVT_Voltage2 = theCascadinator(idplacement+6, txData,0.001,4);
			break;
		case(0x524):
			hpf.IVT_Voltage3 = theCascadinator(idplacement+6, txData,0.001,4);
			break;
		case(0x525):
			hpf.IVT_Temperature = theCascadinator(idplacement+6, txData,0.001,4);
			break;
		case(0x526):
			hpf.IVT_Temperature = theCascadinator(idplacement+6, txData,1,4);
			break;
		case(0x527):
			hpf.IVT_Power = theCascadinator(idplacement+6, txData,1,4);
			break;
		case(0x528):
			hpf.IVT_Coulumbs = theCascadinator(idplacement+6, txData,3600,4);
			break;
		case(0x690):
			hpf.Brake_Temperature_Front_Left = theCascadinator(idplacement+3,txData,1,2);
			hpf.Oil_Temperature_Front_Left = txData[idplacement+5];	
			hpf.Water_Temperature_Front_Left = txData[idplacement+6];
			break;
		case(0x692):
			hpf.Suspension_Front_Left = theCascadinator(idplacement+3,txData,1,2);
			hpf.Oil_Temperature_Front_Right = txData[idplacement+5];	
			hpf.Water_Temperature_Front_Right = txData[idplacement+6];
			hpf.Suspension_Front_Right = theCascadinator(idplacement+7,txData,1,2);
			break;
		case(0x694):
			hpf.APPS1 = theCascadinator(idplacement+3,txData,1,2);
			hpf.Brake_Pressure_Back = theCascadinator(idplacement+5,txData,0.1,2);
			hpf.Brake_Pressure_Front = theCascadinator(idplacement+7,txData,0.1,2);
			hpf.Brake_Temperature_Front_Left = theCascadinator(idplacement+9,txData,1,2);
			break;
		case(0x696):
			hpf.Water_Temperature_Left_Before = txData[idplacement+3];		
			hpf.Water_Temperature_Left_After = txData[idplacement+4];
			hpf.Water_Temperature_Right_Before = txData[idplacement+5];
			hpf.Water_Temperature_Right_After = txData[idplacement+6];
			break;
		case(0x698):
			hpf.Suspension_Back_Left = theCascadinator(idplacement+3,txData,1,2);
			hpf.Suspension_Back_Right = theCascadinator(idplacement+5,txData,1,2);
			break;
		case(0x69B):
			hpf.Brake_Temperature_Back_Right = theCascadinator(idplacement+3,txData,1,2);
			hpf.Brake_Temperature_Back_Left = theCascadinator(idplacement+5,txData,1,2);		
			hpf.Oil_Temperature_Back_Right = txData[idplacement+7];	
			hpf.Oil_Temperature_Back_Left = txData[idplacement+8];
			break;
		case(0x69C):
			hpf.Tire_Temperature_Front_Left_Inside = txData[idplacement+3];	
			hpf.Tire_Temperature_Front_Left_Middle = txData[idplacement+4];			
			hpf.Tire_Temperature_Front_Left_Outside = txData[idplacement+5];
			break;
		case(0x69E):
			hpf.Tire_Temperature_Front_Right_Inside = txData[idplacement+3];	
			hpf.Tire_Temperature_Front_Right_Middle = txData[idplacement+4];			
			hpf.Tire_Temperature_Front_Right_Outside = txData[idplacement+5];
			break;
		case(0x6A0):
			hpf.Tire_Temperature_Rear_Left_Inside = txData[idplacement+3];	
			hpf.Tire_Temperature_Rear_Left_Middle = txData[idplacement+4];			
			hpf.Tire_Temperature_Rear_Left_Outside = txData[idplacement+5];
			break;
		case(0x6A2):
			hpf.Tire_Temperature_Rear_Right_Inside = txData[idplacement+3];	
			hpf.Tire_Temperature_Rear_Right_Middle = txData[idplacement+4];			
			hpf.Tire_Temperature_Rear_Right_Outside = txData[idplacement+5];
			break;
		case(0x6AE):
			hpf.Digital_In = txData[idplacement+3];
			hpf.I_Telemetry = txData[idplacement+4]*0.1;
			hpf.I_Front = txData[idplacement+5]*0.1;
			break;
		case(0x6AF):
			hpf.Digital_In = txData[idplacement+3];
			hpf.I_Inverters = txData[idplacement+4]*0.1;
			hpf.I_ECU = txData[idplacement+5]*0.1;
			hpf.I_Front = txData[idplacement+6]*0.1;
			break;
		case(0x6B0):
			hpf.I_LeftFans = txData[idplacement+3]*0.1;
			hpf.I_RightFans = txData[idplacement+4]*0.1;
			hpf.I_LeftPump = txData[idplacement+5]*0.1;
			hpf.I_RightPump = txData[idplacement+6]*0.1;
			break;
		case(0x6B1):
			hpf.I_BrakeLight = txData[idplacement+3]*0.1;
			hpf.I_Buzzers = txData[idplacement+4]*0.1;
			hpf.I_IVT = txData[idplacement+5]*0.1;
			hpf.I_AccuPCBs = txData[idplacement+6]*0.1;
			hpf.I_AccuFans = txData[idplacement+7]*0.1;
			hpf.I_Freq_IMD = theCascadinator(idplacement+8,txData,1,2);
			hpf.DC_IMD = txData[idplacement+10];
			break;
		case(0x6B2):
			hpf.Digital_In = txData[idplacement+3];
			hpf.I_currentMeasurement = txData[idplacement+4]*0.1;
			hpf.I_TSAL = txData[idplacement+5]*0.1;
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
