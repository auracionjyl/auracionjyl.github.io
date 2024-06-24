function Condition_AI() {

    var that = this;
    this.p = player;
	this.builder = builder;
	this.solver = solver;
	this.candidates = []
		
    this.recommend_move = function(m) {
		that.b.game_status = 'playing';
		$('.headertext h1').text('Waiting for opponent').css('color', '#333333');

		that.candidates = that.solver.select_branch(m)
		for (var i = 0; i < that.candidates.length; i++){
			that.b.add_sol_piece(that.candidates[i])
			that.b.show_last_move(that.candidates[i], -1);
		}
		that.p.color = 1 - that.p.color
		that.player_turn();
    }

    this.tileClickHandler = function(e) {
		if (e.target.className === "solPiece"){
			that.p.move = parseInt(e.target.parentElement.id);
		}
		else{
			that.p.move = parseInt(e.target.id);
		}
		for (var i = 0; i < that.candidates.length; i++){
			that.b.remove_sol_piece(that.candidates[i])
		}
        that.b.add_piece(that.p.move, that.p.color);
        that.b.show_last_move(that.p.move, that.p.color);
		that.b.evaluate_win(that.p.color);
		if(that.b.game_status=='win'){ 
			that.p.score ++; 
			$('#p0-score h2').text(that.p.score); 
			$('#feedback-modal').modal('show')
		}
		else if(that.b.game_status=='draw'){ 
			$('#feedback-modal').modal('show')
		}
        else {
			that.recommend_move(that.p.move);
		}
    }

	this.puzzleClickHandler = function (e){
		if (e.target.className === "tile"){
			that.p.move = parseInt(e.target.id);
		}
		else{
			that.p.move = parseInt(e.target.parentElement.id);
		}
		if (that.b.is_used(that.p.move)){
			that.b.remove_piece(that.p.move)
		}
		else{
			that.b.add_piece(that.p.move, that.builder.color);
			that.b.show_last_move(that.p.move, that.builder.color);
		}
	}

    this.player_turn = function(){
        that.p.move_start = Date.now();
        that.b.highlight_tiles();
        $('.headertext h1').text('Your turn').css('color', '#000000');
        $('.canvas, .tile').css('cursor', 'pointer');
        $('.usedTile, .usedTile div').css('cursor', 'default');
        $('.tile').off('click').on('click', function(e, candidates) { that.tileClickHandler(e); });
    }
    
    this.start_game = function() {
		that.b.fraze_all()
		$('.headertext h1').text('Finding Solutions...').css('color', '#000000');
		that.b.game_status = "playing"
		var selectElement = document.getElementById('win-in-n');
		var selectedValue = selectElement.options[selectElement.selectedIndex].value;
		var black = []
		var white = []
		for (var i = 0; i < M*N; i++){
			if(that.b.puzzle_black_position[i] === 1){black.push(i)}
			if(that.b.puzzle_white_position[i] === 1){white.push(i)}
		}
		that.solve(black, white, selectedValue)
    }

	this.set_puzzle = function (){
		that.b = new Board();
		that.b.create_tiles();
		that.b.highlight_tiles();
		$('.headertext h1').text('Set your puzzle').css('color', '#000000');
		$('.canvas, .tile').css('cursor', 'pointer');
		$('.usedTile, .usedTile div').css('cursor', 'default');
		$('.tile').off('click').on('click', function(e) { that.puzzleClickHandler(e); });
	}

    this.run = function() {
		document.getElementById("reset-board-dialog").addEventListener("click", ()=>{
			$('#feedback-modal').modal('hide');
			$('html').css('cursor', 'none');
			that.solver.reset_board()
			that.set_puzzle();
		})
		document.getElementById("reset-puzzle-dialog").addEventListener("click", ()=>{
			$('#feedback-modal').modal('hide');
			$('html').css('cursor', 'none');
			that.solver.reset_path()
			that.b.reset_puzzle();
			that.player_turn();
		})

		that.makemove = Module.cwrap('makemove', 'number', ['number','string','string','number'])
		document.getElementById("reset-puzzle").style.display = "none"
		document.getElementById("black").addEventListener("click", ()=>{that.builder.color = 0;})
		document.getElementById("white").addEventListener("click", ()=>{that.builder.color = 1;})
		document.getElementById("start").addEventListener("click", that.start_game)
		document.getElementById("reset-board").addEventListener("click", ()=>{that.solver.reset_board();that.set_puzzle();})
		that.set_puzzle();
    }

	this.solve = function (black, white, win_in_n){
		fetch('http://34.66.66.12/api', {
			method: 'POST',
			// mode: 'no-cors',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ black: black, white: white, win_in_n: Number(win_in_n) })
		}).then(response => response.json())
			.then(res => {
				that.solver.solutions = res["result"];
				$('.headertext h1').text('Totally ' + String((res["result"]["-1"]).length) + ' Solutions').css('color', '#000000');
				that.b.highlight_tiles();
				that.candidates = that.solver.init_branch();
				for (var i = 0; i < that.candidates.length; i++){
					that.b.add_sol_piece(that.candidates[i])
					that.b.show_last_move(that.candidates[i], -1);
				}
				that.player_turn()
			})
	}
}