var formulajs = require('formulajs');
var Utils = require('./src/Utils');
var Oms = require('oms');

// SET UP COLLECTIONS
var maxIndex = 0;
var maxObjectid = function() {
	maxIndex++;
	return maxIndex;
};

var MongoLocal = require('mongolocal');
var MongoLocalCalculatorCollection = require('./src/MongoLocalCalculatorCollection');
var collection1 = MongoLocal({objectId: maxObjectid});

var opLog1 = Oms.OmsOplog(collection1, {
	max: 1000
}, {
	server: 'dsnyc1'
});

var opLogSubscriptions1 = Oms.OmsOplogSubscriptions(opLog1);
var omsSubscriptions1 = Oms.OmsSubscriptions(opLogSubscriptions1);

/*
omsSubscriptions1.findSubscribe({_id: 2}, function(error, operation, arg2, arg3) {
	if(error)
		console.error("ERR", error);
	console.log("OP", operation, "ARG2", arg2, arg3);
});
*/

collection1.insert({key1: 0.5, key2: 2, key3: {subkey: 5}});
collection1.insert({key1: 2, key2: 4});

var mcc1 = MongoLocalCalculatorCollection(collection1, omsSubscriptions1);

var collectionManager = require('./src/CollectionManager')({collection1: mcc1}, {defaultCollection: 'collection1'});

// SET UP FORMULAS
var functions = {
	/* max: require('./src/formulas/max'),
	min: require('./src/formulas/min') */
};

for(var key in formulajs) {
	if(typeof formulajs[key] == 'function') {
		(function() {
			var formulaName = key;
			var formulaNameTransformed = formulaName.toLowerCase();
			if(typeof functions[formulaNameTransformed] != 'function') {
				functions[formulaNameTransformed] = function(functionArgs, functionOptions, calculatedCallback) {
					try {
						var inputValues = [];
						functionArgs.forEach(function(functionArg) {
							if(typeof functionArg.value != 'undefined')
								inputValues.push(functionArg.value);
							if(typeof functionArg.cursor != 'undefined') {
								functionArg.cursor.forEach(function(cell) {
									inputValues.push(cell.value);
								});

							}
						});
						calculatedCallback({value: formulajs[formulaName].apply(formulajs, inputValues)});
					}
					catch(error) {
						calculatedCallback({error: error.toString()});
					}
				}
			}
		})();
	}
}

//console.log(process.argv)

var formulaParser = require('./src/FormulaCalculator')(functions, collectionManager);

formulaParser.calculate(process.argv[2], {subscribe: true}, function(result) {
	if(typeof result.error == 'object')
		console.log(result.error.code, result.error.message);
	else
		console.log("RESULT", result);
});

collection1.update({_id: 1}, {key1: 2});
collection1.update({_id: 2}, {key1: 4});
collection1.update({_id: 2}, {key1: 10});
