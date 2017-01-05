Array.prototype.findBy = function (searchBy, equals) {
    for (var i = 0; i < this.length; i++) {
        if (this[i][searchBy] === equals || (searchBy === "" && this[i] === equals)) {
            return this[i];
        }
    }
    return -1;
}

//override alert to create a non-blocking alert
function alert(msg, callback) {
    var html = "<div class='alert-msg'>"+msg+"</div></br><button id='ok' class='ok-btn'>Ok</button>";
    var ele = document.getElementById("alert");
    ele.style.width = "300px";
    //ele.style.height = "250px";
    var body_width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    var body_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    console.log([body_width, body_height]);
    ele.innerHTML = html;
    ele.style.marginLeft = ((body_width - 300) / 2)+"px";
    ele.marginTop = ((body_height - 250) / 2)+"px";
    ele.style.display = "inline";
    setTimeout(function () {
        document.getElementById('ok').onclick = function() {
            closeAlert();
            callback();
        };
    }, 200);
}

function closeAlert() {
    document.getElementById("alert").style.display = "none";
}

function resizeCanvas(canvas, context, localPlayer, game) {
    var body_width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    var body_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    var dim = Math.min(body_width, body_height) - 20; //-20 just in case of weirdness
    console.log("resizing to: "+dim);
    canvas.width = dim;
    canvas.height = dim;
    
    var rot = localPlayer.alignBoardToThisPlayer(canvas, context);
    console.log([rot, game.rotation]);
    if (game.rotation === 0) { 
        game.transformPlayerText(canvas, rot);
    }
    game.rotation = rot;
    
    context.scale(dim / 1000, dim / 1000);
    game.scale = [dim / 1000, dim / 1000];
    //reset drag translations
    game.drawOrigin = [0, 0];
    game.drawTextOrigin = [0, 0];
    //if we don't reset the translations, we can preserve the position with this. However, it may cause the board to go off screen and could be confusing. 
    //Therefore, we will recenter on a resize
    //context.translate(game.drawOrigin[0] / game.scale[0], game.drawOrigin[1] / game.scale[0]); 
}

var run = true;
var kill = false;
function pause() {
    run = !run;
}
var SHOW;
var leftDown = false, rightDown = false, lastTime, deltaTime, canvas, context;
var lastLeft = false, lastRight = false, time = 0; //send update on state change
var gameSocket, localPlayer = 0, gameId, numHumans;

function initCanvas() {
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
    
    /** Initialization code. 
     * If you use your own event management code, change it as required.
     */
    if (canvas.addEventListener) {
        /** DOMMouseScroll is for mozilla. */
        canvas.addEventListener('DOMMouseScroll', wheel, false);
    }
    /** IE/Opera. */
    canvas.onmousewheel = document.onmousewheel = wheel;

    //dragging init
    canvas.addEventListener('mousedown', mousedownFn, false);
    canvas.addEventListener('mousemove', mousemoveFn, false);
    canvas.addEventListener('mouseup', mouseupFn, false);
}
var game = 0;

function renderGame() {
    if (kill) {
        kill = false;
        return;
    }
    requestAnimationFrame(renderGame);
    if (run) {
        var now = performance.now();
        deltaTime = now - lastTime;
        lastTime = now;
        
        //get input
        if (leftDown !== lastLeft || rightDown !== lastRight) {
            lastLeft = leftDown;
            lastRight = rightDown;
            if (localPlayer !== 0) {
                localPlayer.leftDown = leftDown;
                localPlayer.rightDown = rightDown;
                if (numHumans > 1) {
                    gameSocket.emit('move', {gameId: gameId, userId: localPlayer.playerId, left: leftDown, right: rightDown}); //the only data we send is which keys are held down
                }
            }
            time = performance.now();
        }
        
        //draw
        context.save();
        context.setTransform(1,0,0,1,0,0);

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.restore();
        
        
        game.draw(context, deltaTime);
        
        //update
        if (numHumans > 1) {
            //this prevents the local player from updating, otherwise the server will send the update ms later and you have a butterfly effect
            localPlayer.leftDown = false;
            localPlayer.rightDown = false;
        }
        game.update(deltaTime);
        localPlayer.leftDown = leftDown;
        localPlayer.rightDown = rightDown;
    }
}

function unpackUpdate(pack) {
    var i;
    //console.log("pack: "+JSON.stringify(pack));
    for (i = 0; i < pack.balls.length; i++) {
        game.balls[i].position = pack.balls[i].position;
        game.balls[i].vector = pack.balls[i].vector;
        if (pack.balls[i].lastHit === 0) {
            game.balls[i].lastHit = 0;
        } else {
            game.balls[i].lastHit = game.players.findBy("playerId", pack.balls[i].lastHit); //this could be indexed and optimized
        }
        game.balls[i].update(0, [], game.polyBorder); //update physics and other stuff dependent upon the position
    }
    
    for (i = 0; i < pack.players.length; i++) {
        game.players[i].paddlePosition = pack.players[i].position;
    }
}

window.addEventListener("keydown", function (e) {
    var key = e.which || e.keyCode;
    //37 = left, 39 = right
    //alert(key);
    if (key === 37) {
        e.preventDefault();
        leftDown = true;
    }
    if (key === 39) {
        e.preventDefault();
        rightDown = true;
    }
}, false);

window.addEventListener("keyup", function (e) {
    var key = e.which || e.keyCode;
    //37 = left, 39 = right
    //alert(key);
    if (key === 37) {
        e.preventDefault();
        leftDown = false;
    }
    if (key === 39) {
        e.preventDefault();
        rightDown = false;
    }
}, false);

//////////////////////////////////////////////////////zoom and drag around canvas

function rotatedVector(v, rads, ccw) {
    var cos = Math.cos(rads),
        sin = Math.sin(rads);
    var xp, yp;
    
    if (ccw) {
        xp = (v[0] * cos) + (v[1] * sin);
        yp = -(v[0] * sin) + (v[1] * cos);
    } else {
        xp = (v[0] * cos) - (v[1] * sin);
        yp = (v[0] * sin) + (v[1] * cos);
    }
    
    return [xp, yp];
}

var scrollTolerance = 0.01
function handleZoom(delta) {

	scroll = delta;
	if (scroll > 0) {
		game.scale[0] += scrollTolerance;
        game.scale[1] += scrollTolerance;
	}
	if (scroll < 0) {
        //if the scale became negative, everything would be flipped
        if (game.scale[0] - scrollTolerance > scrollTolerance) {
            game.scale[0] -= scrollTolerance;
            game.scale[1] -= scrollTolerance;
        }
	}
    
    //game.scale = [0.5, 0.5];
	
    console.log("New scale: " + game.scale);
    context.setTransform(1, 0, 0, 1, 0, 0);
    var xs = canvas.width / 2,
        ys = canvas.height / 2;
        
    context.translate(xs, ys);
    
    context.scale(game.scale[0], game.scale[1]); //we scale everything by 0.5. our origin is still in the middle of the screen, but we would have to move twice as far, -1000, -1000
    
    context.rotate(game.rotation);
    var dir = [];
    dir[0] = -xs*(1000 / canvas.width);
    dir[1] = -ys*(1000 / canvas.height);
    
    context.translate(dir[0], dir[1]);
    context.translate(game.drawOrigin[0] / game.scale[0], game.drawOrigin[1] / game.scale[0]);
    //console.log("trans scale: "+[game.drawOrigin[0] / game.scale[0], game.drawOrigin[1] / game.scale[0]]);
}

/** Event handler for mouse wheel event.
*/
function wheel(event){
    console.log("handle wheel");
	var delta = 0;
	if (!event) { /* For IE. */
		event = window.event;
	}
	if (event.wheelDelta) { /* IE/Opera. */
        delta = event.wheelDelta/120;
	} else if (event.detail) { /** Mozilla case. */
        /** In Mozilla, sign of delta is different than in IE.
         * Also, delta is multiple of 3.
         */
        delta = -event.detail/3;
	}
	/** If delta is nonzero, handle it.
	 * Basically, delta is now positive if wheel was scrolled up,
	 * and negative, if wheel was scrolled down.
	 */
	if (delta) {
		handleZoom(delta);
	}
	/** Prevent default actions caused by mouse wheel.
	 * That might be ugly, but we handle scrolls somehow
	 * anyway, so don't bother here..
	 */
	if (event.preventDefault) {
		event.preventDefault();
	}
	event.returnValue = false;
}

//dragging canvas
var moving = false;
var touching = false;
var initX, initY, marginTop, marginLeft;

function mousedownFn(e) {
	var btn = e.which;
	
	var x = e.pageX;
	var y = e.pageY;
	initX = Math.round(x);
	initY = Math.round(y);
    console.log("mousedown @ " + [initX, initY]);
    touching = true;
}

function mousemoveFn(e) {
    var relX = Math.round(e.pageX);
    var relY = Math.round(e.pageY);
	
	if (touching){
        
        if (Math.abs(Math.abs(relX)-Math.abs(initX))>1 && Math.abs(Math.abs(relY)-Math.abs(initY))>1){
            moving = true;
        }
        
        if (moving){
            var dir = rotatedVector([relX - initX, relY - initY], Math.abs(game.rotation), game.rotation > 0);
            game.drawOrigin[0] += dir[0];
            game.drawOrigin[1] += dir[1];
            game.drawTextOrigin[0] += (relX - initX);
            game.drawTextOrigin[1] += (relY - initY);
            context.translate(dir[0] / game.scale[0], dir[1] / game.scale[1]);
            //console.log("trans move: "+[dir[0] / game.scale[0], dir[1] / game.scale[1]]);
            initX = relX;
            initY = relY;
        }
	
	}
}

function mouseupFn(e) {
    touching = false;
}
