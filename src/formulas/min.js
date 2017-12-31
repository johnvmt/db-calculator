module.exports = function(functionArgs, functionOptions, calculatedCallback) {
	var minCell = undefined;

	functionArgs.forEach(function(cell) {
		if(typeof cell.value != 'undefined' && (typeof minCell == 'undefined' || minCell.value > cell.value))
			minCell = cell;
	});

	calculatedCallback((typeof minCell != 'undefined') ? minCell : {error: 'input_error', errorText: 'Could not calculate from input'});
};