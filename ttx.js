window.TTX = null;
(function(){
    TTX = function(){
	
	
	// unicode symbols
	var SYMBOLS = {
		heart: '<span style="color: #E32222">&#10084;</span>',
		up: '<span style="color: #0DD11D">&#9650;</span>',
		down: '<span style="color: #C21B1B">&#9660;</span>',
		dj: '&#9835;'
	};
	
        // global state
	var self = this;
	var _premiumIDs = null; // IDs to check against for premium access
        var _premium = null; // enable premium access
        var _turntable = window.turntable; // handle to the turntable object
        
	// room state
	var _id = null; // current user ID
        var _room = null; // handle to the room object
	var _manager = null; // handle to the room manager
        var _location = null; // room URL location
        var _mods = null; // list of moderator IDs for the current room
	var _songHistory = null; // history of objects that look like _currentSong
	var _idleTimers = null; // idle timers of all users
	var _usernames = null; // mapping of username to id
	var _userIdle = null; // mapping of user id to time since last action

	// song state
	var _currentSong = null; // info about the current song, formatted as {artist: 'blah',title: 'blah',dj: '', upvotes: 5, downvotes: 0, hearts: 1}
	var _upvoters = null; // ID of upvoters
	var _downvoters = null; // ID of downvoters
	var _hearts = null; // ID of users who <3 the song
	var _djs = null; // user ids of djs

	// main
	
        resetRoom(function(){
	    checkPremium(); // check premium status
	    initializeUI(); // initialize UI elements
	    resetMods(); // new mods
	    resetDJs(); // new DJs
	    resetUsers(); // new users
	    updateGuests(); // update guest list 
	    updateHeader(); // update header
	    initializeListeners(); // create DOM and Turntable event handlers
	    
        });

        // reset the state of premium access
        function checkPremium(){
            if (_premiumIDs === null || $.inArray(_id,_premiumIDs) >= 0){
                _premium = true;
                log('Premium features enabled');
            }
	    else{
	    	_premium = false;
	    }
        }
	// update header (UI)
	function updateHeader(){
		var header = $('.room .name');
		var song_bar = header.find('#ttx_songbar');
		var text = '(' + _currentSong.upvotes + SYMBOLS.up + ','+ _currentSong.downvotes + SYMBOLS.down + ',' + _currentSong.hearts + SYMBOLS.heart + ') ' + _currentSong.title+' by <b>'+_currentSong.artist+'</b>';
		if (song_bar.length){
			song_bar.html(text);
		}
		else{
			header.text(header.text()+': ');
			$('<span id="ttx_songbar" style="font-size:14px; font-weight:normal">' + text + '</span>').appendTo(header);
		}
	}
	// called every time there is a song change
	function resetSong(){
		_currentSong = {};
		_currentSong.title = _room.currentSong.metadata.song;
		_currentSong.artist = _room.currentSong.metadata.artist;
		_upvoters = {};
		for (var i = 0; i < _room.upvoters.length; i++){
			_upvoters[_room.upvoters[i]] = 1;
		}
		_downvoters = {};
		_hearts = {};
		_currentSong.upvotes = _room.upvoters.length;
		_currentSong.downvotes = 0; // unknown
		_currentSong.hearts = 0; // unknown
		_currentSong.dj = _room.currentSong.djid;
		log(_currentSong);
	}
	// called every time there is a DJ change
	function resetDJs(){
		_djs = {};
		for (var i=0;i<_room.djIds.length;i++){
			_djs[_room.djIds[i]] = 1;
		}
	}
	// add new user
	function addUser(e){
		var now = new Date().getTime();
		for (var i in e.user) {
			var id = e.user[i].userid;
			
			var name = e.user[i].name;
			if (typeof _usernames[name] === 'undefined'){
				_usernames[name] = id;
				_idleTimers[id] = now;
			}
		}
	}
	// called when there is a room change
	function resetUsers(){
		var users = _room.users;
		var now = new Date().getTime();
		_usernames = {};
		_idleTimers = {};
		for (var i in users) {
			// map names to ids
			if (typeof _usernames[ users[i].name ] == 'undefined'){
				_usernames[ users[i].name ] = i;
				_idleTimers[ i ] = now; // last action
			}
		}
	}
	// called when there is a room change
	function resetMods(){
		_mods = {};
		for (var i=0;i<_room.moderators.length;i++){
			_mods[_room.moderators[i]] = 1;
		}
	}
	function newSong(data){
		var votelog = data.room.metadata.votelog;
		var currentSong = data.room.metadata.current_song;
		var downvotes = data.room.metadata.downvotes;
		var upvotes = data.room.metadata.upvotes;
		_currentSong = {};
		_currentSong.hearts = 0;
		_currentSong.downvotes = downvotes;
		_currentSong.upvotes = upvotes;
		_currentSong.artist = currentSong.metadata.artist;
		_currentSong.title = currentSong.metadata.song;
		_currentSong.dj = currentSong.djid;
		
		_upvoters = {};
		_downvoters = {};
		_hearts = {};
		for (var i=0; i<votelog.length; i++){
			var vote = votelog[i];
			if (vote[1] === 'up'){
				_upvoters[vote[0]] = 1;
			}
			else{
				_downvoters[vote[0]] = 1;
			}
		}
	}
	// reset the state of the room
        function resetRoom(callback){
            _room = null;
	    _manager = null;
            _id = null;
            
            for (var o in _turntable){
                if (_turntable[o] !== null && _turntable[o].creatorId){
                    _room = _turntable[o];
                    log('Entering room ' + _location);
		    log(_room);
 		    _id = _room.selfId;
		    log('Room id: ' + _room.roomId);
		    log('User id: ' + _id);
		    break;
                }
            }
            if (_room){ // found turntable room
                for (var o in _room){
                    if(_room[o] !== null && _room[o].myuserid){
                        _manager = _room[o];
			break;
                    }
                }
                if (_manager){
		    _location = window.location.pathname; 
		    TTX.prototype.send({api:'room.info',roomid:_room.roomId, extended:false},function(data){ // get room info and use it for current song information
			if (data.success === false){ // couldn't get info, just do a reset
				log('Failed to query room info');
				resetSong();
				callback();
			}
			else{
				newSong(data);
				callback();
			}
		    });
                }
                else{
                    // try again
                    setTimeout(function(){ resetRoom(callback); }, 250);
                }
            }
            else{
                // try again
                setTimeout(function(){ resetRoom(callback); },250);
            }
        }
	// initialize event handlers
        function initializeListeners(){
            _turntable.addEventListener('message',onMessage);
            log('Event monitor added');
	    $(document).bind('DOMNodeInserted',onDOM);
	    log('DOM monitor added');
	    $(window).bind('resize',onResize);
	    log('Window resize monitor added');
        }
	// perform graphical manipulation
        function initializeUI(){
	    // make it fullscreen
	    $('#outer').width('100%');
	    // reposition the stage, playlist, chat, and guestlist
	    var main_container = $('#outer .roomView');
	    var right_panel = $('#right-panel');
	    var stage = $('#floor-div').parent();
	    var stage_height = stage.height();
	    var stage_width = stage.width();
            var guest_list = right_panel.find('.guest-list-container');
	    var play_list = $('#playlist');
	    var chat = right_panel.find('.chat-container');
	    var room_info = $('#room-info-tab');

	    right_panel.find('.chatHeader').unbind('mousedown').css('cursor', 'default');

	    stage.css({left:235,top:105});

	    guest_list.css({marginLeft:0,left:stage_width+240,width:220,top:105,height:stage_height}).appendTo(main_container);
	    guest_list.find('.guests').css({height:stage_height-38});
	    guest_list.find('.guestListButton').hide();
	    guest_list.find('.guestListSize').css({left:0,width:'100%'});
	    guest_list.find('.chatBar').css({width:'100%'});
	    guest_list.find('.chatResizeIcon').hide();

	    play_list.css({marginLeft:0,left:0,width:230,top:105,height:stage_height}).appendTo(main_container);

	    chat.css({marginLeft:0,position:'absolute',width:'auto',left:stage_width+465,top:105,height:stage_height,right:5}).appendTo(main_container);
	    chat.find('div.messages').css({height: stage_height-63});
	    chat.find('form.input-box').css({width:'100%',left:0,backgroundImage:'none'});
	    chat.find('form.input-box input').css({left:'5px',right:'5px',paddingRight:'0px',width:'auto',backgroundColor:"#fff",border:"1px solid #999"});
	    chat.find('div.guestListButton').hide();
	    chat.find('div.chatBar').css({width:'100%'});
	    chat.find('.guestListIcon').hide();
	    chat.find('.chatResizeIcon').hide();

	    $('.room .name').css({position:'absolute',left:35,right:0,width:'auto'});
	    $('.room').css({position:'absolute',right:425});

	    room_info.find('.content').css({left:0,top:-1*(10+stage_height),height:(10+stage_height)});
	    room_info.find('.songlog').css({height:500});
	    room_info.find('.button').css({left:125}).unbind('click').bind('click',function(){ 
 	    	var direction = 1;
		if ($(this).hasClass('upbutton')){
			direction = -1;
			$(this).removeClass('upbutton');
		}
		else{
			$(this).addClass('upbutton');
		}
		$(this).parent().find('.content, .button').animate({top:'+=' + (stage_height+10)*direction},350);
	    });

	    
            changeClass('.chat-container .messages .message',{width:'100%'});
	    changeClass('.guest-list-container .guests .guest',{width:205,'padding-right':'0px','padding-top':'1px','padding-bottom':'1px'});
	}
	function changeClass(classname,properties){
		var ss = document.styleSheets;
        	for (var i=0; i<ss.length; i++) {
            		var rules = ss[i].cssRules || ss[i].rules;
            		for (var j=0; j<rules.length; j++) {
				if (!(rules[j].selectorText))
					continue;
                		if (rules[j].selectorText.indexOf(classname) > -1) {
                    			for (prop in properties){
						rules[j].style[prop] = properties[prop];
					}
					return;
                		}
            		}
        	}
	}
	function onDOM(e){
		var $element = $(e.target);
		
		// hook to display custom modals
		if ($element.hasClass('modalContainer') ){
			
		}
	}
	function onResize(){
		// TODO
		if ($(window).width() < 1200){
			$('#outer').width('1200px');
		}
		else{
			$('#outer').width('100%');
		}
	}
	function isMod(id){
		return typeof _mods[id] !== 'undefined';
	}
	function isDJ(id){
		return typeof _djs[id] !== 'undefined';
	}
	function isCurrentDJ(id){
		return id === _currentSong.dj;
	}
	function isUpvoter(id){
		return typeof _upvoters[id] !== 'undefined';
	}
	function isDownvoter(id){
		return typeof _downvoters[id] !== 'undefined';
	}
	function isHearter(id){
		return typeof _hearts[id] !== 'undefined';
	}

	// update guest list (UI)
	var guestsTimer = null;
	function updateGuests(){
		if (typeof guestsTimer == "number") {
			clearTimeout(guestsTimer);
			guestsTimer = null;
		}

		// attempt to repaint the DOM in 50 ms unless cancelled
		guestsTimer = setTimeout(function() {
			// get the current time
			var now = new Date().getTime();

			// update the chat box
			var guest_container = $('.guest-list-container .guests');
			var guests = $('.guest-list-container .guest');
			guests.each(function() {
				var $this = $(this);
				var $name = $this.find('.guestName');
				var username = $name.text();
				if (typeof _usernames[username] != 'undefined') {
					var user_id = _usernames[username];
					// update extra classes and idle time
					var extrasClass = '';
					var extrasContent = ' ';
					if ($name.hasClass('mod')){
						extrasClass = extrasClass + ' isMod';
					}
					if ($name.hasClass('superuser')){
						extrasClass = extrasClass + ' isSuper';
					}
					if (isDJ(user_id)){
						extrasClass = extrasClass + ' isDJ';
					        extrasContent = extrasContent + SYMBOLS.dj + ' '; 
					}
					if (isCurrentDJ(user_id)){
						extrasClass = extrasClass + ' isCurrentDJ';
						extrasContent = extrasContent + SYMBOLS.dj + ' ';
					}
					if (isHearter(user_id)){
						extrasClass = extrasClass + ' isHearter';
						extrasContent = extrasContent + SYMBOLS.heart + ' ';
					}
					if (isUpvoter(user_id)){
						extrasClass = extrasClass + ' isUpvoter';
						extrasContent = extrasContent + SYMBOLS.up + ' ';
					}
					if (isDownvoter(user_id)){
						extrasClass = extrasClass + ' isDownvoter';
						extrasContent = extrasContent + SYMBOLS.down + ' ';
					}
					var extras = $this.find('.guestExtras');
					if (extras.length){
						extras.html(extrasContent);
					}
					else{
						$name.after($('<span class="guestExtras" style="font-weight:bold; font-size:14px;">'+extrasContent+'</span>'));
					}
					$this.removeClass('isDJ isMod isSuper isUpvoter isDownvoter isHearter isIdle isCurrentDJ').addClass(extrasClass);
				}
			});
			guests.filter('.isDownvoter').prependTo(guest_container); // then downvoters
			guests.filter('.isUpvoter').prependTo(guest_container); // then upvoters
			guests.filter('.isHearter').prependTo(guest_container); // then hearters
			guests.filter('.isMod').prependTo(guest_container); // then mods
			guests.filter('.isSuper').prependTo(guest_container); // then super users
		        guests.filter('.isDJ').prependTo(guest_container); // DJs first
			
		
			}, 50);
	}
	function addVotes(e){
		var data = e.room.metadata.votelog[0];
		var id = data[0];
		var vote = data[1];
		if (id === ''){
			log('Vote ID unknown: ' + vote);
			if (vote === 'up'){
				_currentSong.upvotes = _currentSong.upvotes + 1;
			}
			else{
				_currentSong.downvotes = _currentSong.downvotes + 1;
			}
			return;
		}
		if (vote === 'up'){
			if ( typeof(_upvoters[id]) === 'undefined' ){ // new upvote
				_upvoters[id] = 1;
				_currentSong.upvotes = _currentSong.upvotes + 1;
			}
			if ( typeof(_downvoters[id]) !== 'undefined' ){ // .. used to be a downvote
				delete(_downvoters[id]);
				_currentSong.downvotes = _currentSong.downvotes - 1;
			}
		}
		else{
			if ( typeof(_downvoters[id]) === 'undefined' ){ // new downvote
				_downvoters[id] = 1;
				_currentSong.downvotes = _currentSong.downvotes + 1;
			}
			if ( typeof(_upvoters[id]) !== 'undefined' ){ // .. used to be an upvote
				delete(_upvoters[id]);
				_currentSong.upvotes = _currentSong.upvotes - 1;
			}
		}
	
	}
	function addHearts(e){
		if (typeof _hearts[e.userid] === 'undefined'){ // new heart
			_hearts[e.userid] = 1;
			_currentSong.hearts = _currentSong.hearts + 1;
		}
	}

        function onMessage(e){
            if (e.hasOwnProperty('msgid')) {
    		return;
	    }
	    log('Command: ' + e.command);
	    if (e.command == 'rem_dj') {
		resetDJs(); // reset djs
	    } else if (e.command == 'add_dj') {
		resetDJs(); // reset djs
	    } else if (e.command == 'speak' && e.userid) {
	    } else if (e.command == 'newsong') {
		newSong(e);
		updateHeader(); // reflect change in header
	    } else if (e.command == 'update_votes') {
		addVotes(e);
		updateHeader(); // reflect vote change in header
	    } else if (e.command == 'update_user') {
	    }
	    else if (e.command == 'registered') {
		if( _location !== window.location.pathname ){
			resetRoom(function(){
				checkPremium(); // check premium status
	    			initializeUI(); // initialize UI elements
	    			resetMods(); // new mods
	    			resetDJs(); // new DJs
	    			resetUsers(); // new users
	    			updateGuests(); // update guest list 
				updateHeader(); // update header
			});
		}
		else{
			addUser(e);
		}
	    } else if (e.command == 'snagged') {
            	addHearts(e);
		log(e);
		updateHeader();
	    } else if (e.command == 'pmmed') {
            } else if (e.command == 'deregistered'){
	    }
	    updateGuests(); // update guest list every time something happens
        }
        
        function log(message){
            if (window.console){
                window.console.log(message);
            }
        }
        function reset(){
            // TODO
        }
	// api send
	function send(data,callback){
		TTX.prototype.send(data,callback);
	}
    }
    TTX.prototype.send = function(data,callback){
    		var msg,
		    defer = $.Deferred();

		if (data.api == "room.now") {
			defer.resolved();
			callback();
			return defer.promise();
		}
		data.msgid = turntable.messageId;
		turntable.messageId += 1;
		data.clientid = turntable.clientId;
		if (turntable.user.id && !data.userid) {
			data.userid = turntable.user.id;
			data.userauth = turntable.user.auth;
		}
		msg = JSON.stringify(data);
		turntable.whenSocketConnected(function () {
			turntable.socket.send(msg);
			turntable.socketKeepAlive(true);
			turntable.pendingCalls.push({
				msgid: data.msgid,
				handler: callback,
				deferred: defer,
				time: util.now()
			});
		});
		return defer.promise();
    };

})();

turntableX = new TTX();
