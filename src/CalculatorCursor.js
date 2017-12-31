function GenericCursor(peekCallback, nextCallback, rewindCallback) {
	this._peekResult = peekCallback;
	this._nextResult = nextCallback;
	this._rewindResult = rewindCallback;
}

GenericCursor.prototype.next = function(callback) {
	this._nextResult(function(error, result) {
		if(typeof callback == 'function')
			callback(error, result);
	});
};

GenericCursor.prototype.hasNext = function(callback) {
	this._peekResult(function(error, result) {
		if(typeof callback == 'function')
			callback(error == null);
	});
};

GenericCursor.prototype.rewind = function(callback) {
	this._rewindResult(function(error) {
		if(typeof callback == 'function')
			callback(error);
	});
};

GenericCursor.prototype.forEach = function(callback) {
	if(typeof callback == 'function') {
		var cursor = this;
		getNext();

		function getNext() {
			cursor.next(function(error, result) {
				if (error == null) {
					callback(result);
					getNext();
				}
			});
		}
	}
};

GenericCursor.prototype.toArray = function(callback) {
	var cursor = this;
	var results = [];
	getNext();

	function getNext() {
		cursor.hasNext(function(hasNext) {
			if(hasNext) {
				cursor.next(function(error, result) {
					if (error == null) {
						results.push(result);
						getNext();
					}
					else
						callback(error, null);
				});
			}
			else
				callback(null, results);
		});
	}
};

module.exports = function(peekCallback, nextCallback, rewindCallback) {
	return new GenericCursor(peekCallback, nextCallback, rewindCallback);
};