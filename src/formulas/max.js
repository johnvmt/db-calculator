module.exports = function(functionArgs, functionOptions, calculatedCallback) {
	var maxCell = undefined;

	functionArgs.forEach(function(cell) {
		if(typeof cell.value != 'undefined' && (typeof maxCell == 'undefined' || maxCell.value < cell.value))
			maxCell = cell;
	});

	calculatedCallback((typeof maxCell != 'undefined') ? maxCell : {error: 'input_error', errorText: 'Could not calculate from input'});
};