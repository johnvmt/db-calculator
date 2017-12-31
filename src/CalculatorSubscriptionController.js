function CalculatorSubscriptionController(handlers) {
	this.handlers = (typeof handlers == 'object' && handlers != null) ? handlers : {};
}

CalculatorSubscriptionController.prototype.cancel = function(callback) {
	var self = this;
	if(typeof self.handlers.cancel == 'function')
		self.handlers.cancel(callbackSafe);
	else
		callbackSafe('not_defined', null);

	function callbackSafe(error, result) {
		if(typeof callback == 'function')
			callback(error, result);
	}
};

module.exports = function(handlers) {
	return new CalculatorSubscriptionController(handlers);
};