function CalculatorError(code, message) {
	this.code = code;
	this.message = message || 'Unknown Error';
	this.stack = (new Error()).stack;
}

CalculatorError.prototype = Object.create(Error.prototype);
CalculatorError.prototype.constructor = CalculatorError;

module.exports = CalculatorError;