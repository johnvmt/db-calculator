var tokenizeFormula = require('excel-formula-tokenizer').tokenize;
var buildFormulaTree = require('excel-formula-ast').buildTree;
var CalculatorError = require('./CalculatorError');
var Utils = require('./Utils');

function FormulaParser() {

}

/**
 *
 * @param formulaString
 * @returns {*}
 */
FormulaParser.prototype.buildTree = function(formulaString) {
	return buildFormulaTree(tokenizeFormula(formulaString));
};

/**
 *
 * @param callbacks
 * @param rootNode
 */
FormulaParser.prototype.traverseTree = function(callbacks, rootNode) {
	var parser = this;
	if(typeof rootNode == 'undefined') // Top of tree not defined
		throw new CalculatorError('rootNode_undefined', "Root node was not defined");

	var childrenCompleteCount = 0;
	var childrenComplete = [];
	var childrenResults = [];

	var childrenReachedBottomCount = 0;
	var childrenAscendCallbacks = [];

	// Descend
	if(typeof callbacks.descend == 'function')
		callbacks.descend(rootNode, descendChildren);
	else
		descendChildren();

	// Called after rootNode processed on way down
	function descendChildren() {
		if(Array.isArray(rootNode.arguments)) { // has children
			rootNode.arguments.forEach(function(childNode, childIndex) {
				var bottomCallback = function(ascendCallback) {
					if(typeof childrenAscendCallbacks[childIndex] == 'undefined')
						childrenReachedBottomCount++;

					childrenAscendCallbacks[childIndex] = ascendCallback;

					if(childrenReachedBottomCount == rootNode.arguments.length)
						reachedBottom();
				};

				var completeCallback = function(childResult) {
					if(typeof childrenComplete[childIndex] != 'boolean' || !childrenComplete[childIndex]) {
						childrenComplete[childIndex] = true;
						childrenCompleteCount++;
					}

					childrenResults[childIndex] = childResult;

					if(childrenCompleteCount == rootNode.arguments.length)
						ascendLocal();
				};

				var childCallbacks = Utils.objectMerge(callbacks, {bottom: bottomCallback, complete: completeCallback});

				parser.traverseTree(childCallbacks, childNode);
			});
		}
		else
			reachedBottom();
	}

	function reachedBottom() {
		if(typeof callbacks.bottom == 'function')
			callbacks.bottom(beginAscent);
		else
			beginAscent();
	}

	function beginAscent() {
		if(childrenAscendCallbacks.length) {
			childrenAscendCallbacks.forEach(function(childrenAscendCallback) {
				childrenAscendCallback();
			});
		}
		else // leaf node
			ascendLocal();
	}

	function ascendLocal() {
		if (typeof callbacks.ascend == 'function') {
			callbacks.ascend(rootNode, childrenResults, function (localResult) {
				if (typeof callbacks.complete == 'function')
					callbacks.complete(localResult);
			});
		}
		else
			callbacks.complete(null);
	}
};

module.exports = function() {
	return new FormulaParser();
};