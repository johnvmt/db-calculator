var CalculatorCursor = require('./src/CalculatorCursor');

var result = [1,2,3,4,5,6,7,8,9,10,11];
var index = 0;

var cursor = CalculatorCursor(function(callback) {
	// peek
	if(index < 0 || index >= result.length)
		callback('out_of_bounds', null);
	else
		callback(null, result[index]);
},
function(callback) {
	// next
	index++;
	if(index - 1 < 0 || index - 1 >= result.length)
		callback('out_of_bounds', null);
	else
		callback(null, result[index - 1]);
},
function(callback) {
	// rewind
	index = 0;
	callback(null)
});

getNext();

function getNext() {
	cursor.hasNext(function(hasNext) {
		if(hasNext) {
			cursor.next(function (error, result) {
				console.log(error, result);
				getNext();
			});
		}
		else
			console.log("DONE");
	});
}
