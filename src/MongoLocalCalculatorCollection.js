var CalculatorError = require('./CalculatorError');
var CalculatorCursor = require('./CalculatorCursor');
var CalculatorSubscriptionController = require('./CalculatorSubscriptionController');
var Utils = require('./Utils');

function MongoLocalCalculatorCollection(mongoCollection, omsSubscriptions) {
	this._mongoCollection = mongoCollection;
	this._omsSubscriptions = omsSubscriptions;

	this.options = {
		attributeSeparator: '.',
		docSeparator: '.'
	}
}

MongoLocalCalculatorCollection.prototype.findRange = function(startingAddressInternalRaw, endingAddressInternalRaw, options, callback) {
	var self = this;
	var startingAddressInternal = (typeof startingAddressInternalRaw == 'string') ? this._parseAddress(startingAddressInternalRaw) : startingAddressInternalRaw;
	var endingAddressInternal = (typeof endingAddressInternalRaw == 'string') ? this._parseAddress(endingAddressInternalRaw) : endingAddressInternalRaw;

	var startingDocIdInt = startingAddressInternal.docId;
	var endingDocIdInt = endingAddressInternal.docId;

	var subscriptionController = null;
	var findController = CalculatorSubscriptionController({
		cancel: function(cancelCallback) {
			if(subscriptionController != null)
				subscriptionController.cancel(cancelCallback);
			else
				cancelCallback(null, true);
		}
	});

	if(typeof options.subscribe != 'undefined' && options.subscribe) { // Subscribe
		subscriptionController = this._omsSubscriptions.subscribeObject({_id: {$gte: startingDocIdInt, $lte: endingDocIdInt}}, function(error, operationDoc) {
			if(error)
				callback(error, null);
			else if(operationDoc.operation == 'insert' && Utils.objectIsset(operationDoc.doc, startingAddressInternal.attributes))
				findCollection();
			else if(operationDoc.operation == 'update' && (Utils.objectIsset(operationDoc.modifiedDoc, startingAddressInternal.attributes) != Utils.objectIsset(operationDoc.unmodifiedDoc, startingAddressInternal.attributes) || Utils.objectGet(operationDoc.unmodifiedDoc, startingAddressInternal.attributes) !== Utils.objectGet(operationDoc.modifiedDoc, startingAddressInternal.attributes)))
				findCollection();
			else if(operationDoc.operation == 'remove')
				findCollection();
		});

	}

	findCollection(); // Return the initial cursor

	return findController;

	// TODO restructure
	function findCollection() {
		self._mongoCollection.find({_id: {$gte: startingDocIdInt, $lte: endingDocIdInt}}, function(error, mongoCursor) {
			if(error)
				callback(error, null);
			else {

				function cursorPeek(callback) {
					mongoCursor.hasNext(function(error, hasNext) {
						if(error)
							callback(error, null);
						else if(!hasNext)
							callback('cursor_end', null);
						else {
							var doc = mongoCursor._peekResult().doc;

							var cellAddress = {
								docId: doc._id,
								attributes: startingAddressInternal.attributes
							};
							var cell = {address: self.joinAddress(cellAddress)};

							if(!Utils.objectIsset(doc, startingAddressInternal.attributes))
								cell.error = 'attribute_not_set';
							else
								cell.value = Utils.objectGet(doc, cellAddress.attributes);

							callback(null, cell);
						}
					});
				}

				function cursorNext(callback) {
					cursorPeek(function(error, cell) {
						mongoCursor.next(function() {
							callback(error, cell);
						});
					});
				}

				function cursorRewind(callback) {
					mongoCursor.rewind(callback);
				}
			}

			callback(null, new CalculatorCursor(cursorPeek, cursorNext, cursorRewind));
		});
	}
};

MongoLocalCalculatorCollection.prototype.findOne = function(addressInternalRaw, options, callback) {
	var addressInternal = (typeof addressInternalRaw == 'string') ? this._parseAddress(addressInternalRaw) : addressInternalRaw;

	if(typeof options.subscribe != 'undefined' && options.subscribe) { // Subscribe
		var subscribeResultFound = false; // Return an error if find-complete is triggered, but no insert has been passed
		var lastError = null; // Do not trigger if multiple not_founds in a row
		var subscriptionController = this._omsSubscriptions.findSubscribeOneObject({_id: addressInternal.docId}, function(error, operationDoc) {
			if(error)
				callbackSafe(error, null);
			else if(operationDoc.operation == 'subscribe' && operationDoc.status == 'find-complete' && !subscribeResultFound) // Initial find completed without results
				callbackSafe('not_found', null);
			else if(operationDoc.operation == 'insert' && Utils.objectIsset(operationDoc.doc, addressInternal.attributes))
				callbackSafe(null, Utils.objectGet(operationDoc.doc, addressInternal.attributes));
			else if(operationDoc.operation == 'update') {
				if(!Utils.objectIsset(operationDoc.modifiedDoc, addressInternal.attributes)) // Modified doc doesn't have attribute
					callbackSafe('not_found', null);
				else if(Utils.objectGet(operationDoc.unmodifiedDoc, addressInternal.attributes) !== Utils.objectGet(operationDoc.modifiedDoc, addressInternal.attributes)) // Modified and unmodified are different
					callbackSafe(null, Utils.objectGet(operationDoc.modifiedDoc, addressInternal.attributes));
			}
			else if(operationDoc.operation == 'remove')
				callbackSafe('not_found', null);
		});

		return subscriptionController;

		function callbackSafe(error, value) {
			if(error && lastError !== error) {
				lastError = error;
				callback(error, null); // TODO attach subscription
			}
			else {
				lastError = null;
				subscribeResultFound = true;
				callback(null, {value: value});
			}
		}
	}
	else { // Don't subscribe
		var findCanceled = false;
		var findController = CalculatorSubscriptionController({
			cancel: function(cancelCallback) {
				findCanceled = true;
				cancelCallback(null, true);
			}
		});

		this._mongoCollection.findOne({_id: addressInternal.docId}, function(error, doc) {
			if(!findCanceled) { // TODO actually cancel find job
				if(error)
					callback(error, null);
				else if(doc == null || !Utils.objectIsset(doc, addressInternal.attributes))
					callback('not_found', null);
				else
					callback(null, {value: Utils.objectGet(doc, addressInternal.attributes)});
			}
		});

		return findController;
	}
};

MongoLocalCalculatorCollection.prototype.normalizeAddress = function(requestedAddressInternalString, startingAddressInternalString) {
	var requestedAddressInternal = this._parseAddress(requestedAddressInternalString);

	if(typeof requestedAddressInternal.docId == 'undefined') { // docId not specified in requested
		var startingAddressInternal = this._parseAddress(startingAddressInternalString);
		if(typeof startingAddressInternal.docId == 'undefined')
			throw new CalculatorError('docId_undefined', 'docId could not be determined');
		else
			return this.joinAddress({docId: startingAddressInternal.docId, attributes: requestedAddressInternal.attributes});
	}
	else // docId was specified in requested
		return this.joinAddress(requestedAddressInternal);
};

MongoLocalCalculatorCollection.prototype.joinAddress = function(address) {
	return address.docId + this.options.docSeparator + address.attributes.join(this.options.attributeSeparator);
};

MongoLocalCalculatorCollection.prototype._parseAddress = function(addressInternal) {
	var docIdEndIndex = addressInternal.indexOf(this.options.docSeparator);

	var docId = addressInternal.substring(0, docIdEndIndex >= 0 ? docIdEndIndex : addressInternal.length);
	var attributesJoined = addressInternal.substring(docIdEndIndex >= 0 ? docIdEndIndex + this.options.docSeparator.length : 0);

	var address = {};

	if(docId.length)
		address.docId = parseInt(docId);

	if(attributesJoined.length)
		address.attributes = attributesJoined.split(this.options.attributeSeparator);

	return address;
};

module.exports = function(mongoCollection, omsSubscriptions) {
	return new MongoLocalCalculatorCollection(mongoCollection, omsSubscriptions);
};