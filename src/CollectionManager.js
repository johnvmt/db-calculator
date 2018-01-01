var CalculatorError = require('./CalculatorError');
var Utils = require('./Utils');

function CollectionManager(collections, options) {
	this.collections = collections;

	var defaultOptions = {
		collectionSeparator: '!'
	};

	this.options = Utils.objectMerge(defaultOptions, options);
}

CollectionManager.prototype.findRange = function () {
	var rangeStartingAddressString = arguments[0];
	var rangeEndingAddressString = arguments[1];
	var options = {};
	var callback = null;
	if(arguments.length == 4) {
		options = arguments[2];
		callback = arguments[3];
	}
	else if(arguments.length == 5) {
		var startingAddressString = arguments[2];
		options = arguments[3];
		callback = arguments[4];
	}

	try {
		var rangeStartingAddress = this.parseAddress(rangeStartingAddressString, startingAddressString);
		var rangeEndingAddress = this.parseAddress(rangeEndingAddressString, rangeStartingAddressString);

		if(rangeStartingAddress.collection != rangeEndingAddress.collection)
			callbackCursor(new CalculatorError('collection_mismatch', "Collections for start and end of range do not match"), null);
		else if(typeof rangeStartingAddress.collection == 'undefined')
			callbackCursor(new CalculatorError('collection_undefined', "Collection not set"), null);
		else {
			if (typeof startingAddressString == 'string')
				var startingAddress = this.parseAddress(startingAddressString);

			var requestedCollection = this.collections[rangeStartingAddress.collection];

			if (typeof startingAddress == 'object' && rangeStartingAddress.collection == startingAddress.collection && typeof requestedCollection.normalizeAddress == 'function') { // Relative in same collection, and collection supports normalizing addresses
				var rangeStartingAddressInternal = requestedCollection.normalizeAddress(rangeStartingAddress.internal, startingAddress.internal);
				var rangeEndingAddressInternal = requestedCollection.normalizeAddress(rangeEndingAddress.internal, startingAddress.internal);
			}
			else {
				var rangeStartingAddressInternal = rangeStartingAddress.internal;
				var rangeEndingAddressInternal = rangeEndingAddress.internal;
				var rangeEndingAddressInternal = rangeEndingAddress.internal;
			}

			return requestedCollection.findRange(rangeStartingAddressInternal, rangeEndingAddressInternal, options, callbackCursor);
		}
	}
	catch(error) {
		console.log(error);
		callbackCursor(error, null);
	}

	function callbackCursor(error, collectionCursor) {
		if(error)
			callback({error: error});
		else
			callback({cursor: collectionCursor});
	}
};

/**
 * @param requestedAddressString
 * @param startingAddressString
 * @param callback
 */
CollectionManager.prototype.findOne = function() {
	var manager = this;
	var requestedAddressString = arguments[0];
	var callback = null;
	var options = {};
	var startingAddressString = null;

	if(arguments.length == 3) {
		options = arguments[1];
		callback = arguments[2];
	}
	else if(arguments.length == 4) {
		startingAddressString = arguments[1];
		options = arguments[2];
		callback = arguments[3];
	}

	try {
		var requestedAddress = this.parseAddress(requestedAddressString, startingAddressString);
		if(typeof startingAddressString == 'string')
			var startingAddress = this.parseAddress(startingAddressString);

		if(typeof this.collections[requestedAddress.collection] == 'undefined')
			callbackCell('collection_undefined', null);
		else {
			var requestedCollection = this.collections[requestedAddress.collection];

			if(typeof startingAddress == 'object' && requestedAddress.collection == startingAddress.collection && typeof requestedCollection.normalizeAddress == 'function') // Relative in same collection, and collection supports normalizing addresses
				var requestedAddressInternal = requestedCollection.normalizeAddress(requestedAddress.internal, startingAddress.internal);
			else
				var requestedAddressInternal = requestedAddress.internal;

			return requestedCollection.findOne(requestedAddressInternal, options, callbackCell);
		}
	}
	catch(error) {
		callbackCell(error, null);
	}

	function callbackCell(error, cell) {
		if(error)
			cell = {error: error};

		var addressJoined = manager.joinAddress({collection: requestedAddress.collection, internal: requestedAddressInternal});
		cell.address = addressJoined;

		callback(cell);
	}
};

CollectionManager.prototype.joinAddress = function(address) {
	return address.collection + this.options.collectionSeparator + address.internal;
};

CollectionManager.prototype.parseAddress = function(requestedAddressString, startingAddressString) {
	// [Collection!][Internal]
	var startingCollectionKey = typeof startingAddressString == 'string' ? this.addressCollection(startingAddressString, null) : null; // Get the collection key for the starting address, if one exists
	var requestedCollectionKey = this.addressCollection(requestedAddressString, startingCollectionKey);
	var requestedInternalKey = this.addressInternal(requestedAddressString);

	return {
		collection: requestedCollectionKey,
		internal: requestedInternalKey
	};
};

CollectionManager.prototype.addressCollection = function(addressString, startingCollection) {
	var collectionKeyEnd = addressString.indexOf(this.options.collectionSeparator);
	if(collectionKeyEnd >= 0) // Collection specified in address
		return addressString.substring(0, collectionKeyEnd);
	else if(typeof startingCollection == 'string') {
		if(typeof this.collections[startingCollection] != 'undefined')
			return startingCollection;
		else
			throw new CalculatorError('startingCollection_undefined', "'" + startingCollection + "' collection not found in collection list");
	}
	else if(typeof this.options.defaultCollection == 'string') {
		if(typeof this.collections[this.options.defaultCollection] != 'undefined')
			return this.options.defaultCollection;
		else
			throw new CalculatorError('defaultCollection_undefined', "'" + this.options.defaultCollection + "' collection not found in collection list");
	}
	else
		throw new CalculatorError('collection_undefined', "Collection could not be determined");
};

CollectionManager.prototype.addressInternal = function(addressString) {
	var collectionKeyEnd = addressString.indexOf(this.options.collectionSeparator);
	return addressString.substring(collectionKeyEnd >= 0 ? collectionKeyEnd + this.options.collectionSeparator.length : 0);
};

module.exports = function(collections, options) {
	return new CollectionManager(collections, options);
};