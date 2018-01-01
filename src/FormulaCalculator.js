var FormulaParser = require('./FormulaParser');
var CalculatorError = require('./CalculatorError');
var CalculatorSubscriptionController = require('./CalculatorSubscriptionController');
var Utils = require('./Utils');

function FormulaCalculator(functions, collectionManager) {
	this.functions = functions;
	this.collectionManager = collectionManager;
	this._parser = FormulaParser();
}

/**
 *
 * @param formulaString
 * @param options
 * @param callback
 */
FormulaCalculator.prototype.calculate = function() {
	var formulaString = arguments[0];
	var passedOptions = (arguments.length == 3) ? arguments[1] : {};
	var completeCallback = (arguments.length == 3) ? arguments[2] : arguments[1];
	var subscriptionControllers = [];

	var defaultOptions = {
		startingAddress: undefined,
		functions: this.functions,
		collectionManager: this.collectionManager,
		subscribe: false,
		cache: true
	};

	var options = Utils.objectMerge(defaultOptions, passedOptions);

	try {
		var formulaTree = this._parser.buildTree(formulaString);
		var savedCompleteResult = null; // Prevent from calling back multiple times with same result

		var functionOptions = {};

		// Start define traversal callbacks
		var traverseCallbacks = {};

		traverseCallbacks.bottom = function(callback) {
			// TODO fulfill cells?
			callback();
		};

		traverseCallbacks.complete = function(calculatedResult) {
			if(!options.cache || !Utils.objectDeepEqual(calculatedResult, savedCompleteResult)) {
				if(options.cache)
					savedCompleteResult = calculatedResult;
				completeCallback(calculatedResult);
			}
		};

		traverseCallbacks.descend = function(node, callback) {
			switch (node.type) {
				case 'binary-expression':
					node.arguments = [node.left, node.right];
					break;
				case 'unary-expression':
					node.arguments = [node.operand];
					break;
			}
			callback();
		};

		traverseCallbacks.ascend = function(node, calculatedArguments, callback) {
			var subscriptionController = null;
			switch(node.type) {
				case 'text':
				case 'number':
				case 'logical':
					callbackIfResultChanged({value: node.value});
					break;
				case 'cell':
					if(typeof options.startingAddress == 'string')
						subscriptionController = options.collectionManager.findOne(node.key, options.startingAddress, options, callbackIfResultChanged);
					else
						subscriptionController = options.collectionManager.findOne(node.key, options, callbackIfResultChanged);
					break;
				case 'cell-range':
					if(Utils.objectIsset(node, ['left', 'key']) && Utils.objectIsset(node, ['right', 'key'])) {
						if(typeof options.startingAddress == 'string')
							subscriptionController = options.collectionManager.findRange(Utils.objectGet(node, ['left', 'key']), Utils.objectGet(node, ['right', 'key']), options.startingAddress, options, callbackIfResultChanged);
						else
							subscriptionController = options.collectionManager.findRange(Utils.objectGet(node, ['left', 'key']), Utils.objectGet(node, ['right', 'key']), options, callbackIfResultChanged);
					}
					else
						callbackIfResultChanged({error: 'invalid_range'});
					break;
				case 'function':
					var functionName = node.name.toLowerCase();
					if(typeof options.functions[functionName] == 'function')
						options.functions[functionName](calculatedArguments, functionOptions, callback);
					else
						callbackIfResultChanged({error: 'function_undefined'});
					break;
				case 'binary-expression':
					if('value' in calculatedArguments[0] && 'value' in calculatedArguments[1]) {
						try {
							var operationResult = eval(calculatedArguments[0].value.toString() + node.operator + calculatedArguments[1].value.toString());
							callbackIfResultChanged({value: operationResult});
						}
						catch(error) {
							callbackIfResultChanged({error: error.toString()});
						}
					}
					else
						callbackIfResultChanged({error: 'operands_undefined'});
					break;
				case 'unary-expression':
					if('value' in calculatedArguments[0]) {
						try {
							var operationResult = eval(node.operator + calculatedArguments[0].value.toString());
							callbackIfChanged({value: operationResult});
						}
						catch(error) {
							callbackIfChanged({error: error.toString()});
						}
					}
					else
						callbackIfChanged({error: 'operands_undefined'});
					break;
			}

			if(subscriptionController !== null && subscriptionController !== undefined)
				subscriptionControllers.push(subscriptionController);

			function callbackIfResultChanged(nodeResult) {
				if(!options.cache || !Utils.objectDeepEqual(nodeResult, node.result)) {
					if(options.cache)
						node.result = nodeResult;
					callback(nodeResult);
				}
			}
		};

		this._parser.traverseTree(traverseCallbacks, formulaTree);

		return CalculatorSubscriptionController({
			cancel: function(callback) {
				// TODO react to callbacks from cancellations
				while(subscriptionControllers.length) {
					var subscriptionController = subscriptionControllers.pop();
					subscriptionController.cancel();
				}
				callback(null, true);
			}
		});
	}
	catch(error) {
		completeCallback({error: new CalculatorError('parse', 'Formula could not be parsed')});
	}
};

module.exports = function(functions, collectionManager) {
	return new FormulaCalculator(functions, collectionManager);
};