var express = require('express');
var app = express();                               // create our app w/ express
var http = require('http');
var now = require('performance-now');
var createGame = require('gameloop');
//var server = http.createServer(app);
//var io = require('socket.io')(server);

//custom libs
var pong = require('./public/pong');

var users, localGame, game = createGame(), namespace, gameId;
var leftDown = false, rightDown = false, lastTime, deltaTime;

Array.prototype.findBy = function (searchBy, equals) {
    for (var i = 0; i < this.length; i++) {
        if (this[i][searchBy] === equals || (searchBy === "" && this[i] === equals)) {
            return {
                found: this[i],
                index: i
            };
        }
    }
    return -1;
}

Array.prototype.removeBy = function (searchBy, equals) {
    for (var i = 0; i < this.length; i++) {
        if ((searchBy === "" && this[i] === equals)) {
            return {
                removed: this.splice(i, 1),
                index: i
            };
        } else if (this[i][searchBy] === equals) {
            return {
                removed: this.splice(i, 1),
                index: i
            };
        }
    }
    return -1;
}

process.on('message', function (e) {
    //console.log("game server: event: ");
    //console.dir(e);
    switch (e.type) {
        case 'init':
            console.log("game server: received init event");
            users = e.users;
            namespace = e.attr.gameId; //this is actually a room
            gameId = e.attr.gameId;
            
            console.log("game server: creating game");
            var ids = [];
            var names = [];
            for (var p = 0; p < users.length; p++) {
                ids.push(users[p].userId);
                names.push(users[p].username);
            }
            
            localGame = pong.createGame({width: 1000, height: 1000}, e.attr.numPlayers, e.attr.sideLength, true, ids, names, e.attr.gametype, e.attr.maxPoints, e.attr.maxLives, 
                e.attr.numBalls);
            console.dir("game server: game: ");
            console.dir(localGame);
            lastTime = now();
            //process.nextTick(renderGame);
            setTimeout(function () {
                var interval = setInterval(renderGame, 17);
            }, 5000);
        break;
        case 'move':
            //console.log("game server: got move: " + e.msg);
            var affect = localGame.players.findBy("playerId", e.msg.userId); //TODO: optimize by indexing
            if (affect !== -1) {
                if (affect.found.type === "paddle") {
                    affect.found.leftDown = e.msg.left;
                    affect.found.rightDown = e.msg.right;
                }
            }
            //process.send({namespace: namespace, msg: ("left: "+leftDown+" right: "+rightDown)}); //optional acknowledgement
        break;
        case "leave": //the user has voluntarily left the game and must be removed. Not deleted, but marked as gone
            console.log("game <"+namespace+">: player left: "+e.msg.userId);
            var affect = localGame.players.findBy("playerId", e.msg.userId); //TODO: optimize by indexing
            if (affect !== -1) {
                //this is a psuedo-delete and is not sent to clients. It tells the parent to remove this socket from the room
                process.send({namespace: namespace, protocol: "player_leave", msg: e.msg.userId});
                //this tells the other players and updates the game state
                affect.found.lose(true);
                process.send({namespace: namespace, protocol: "player_disconnect", msg: affect.index});
            }
        break;
        case 'player_disconnect':
            var f = localGame.players.findBy("playerId", e.userId);
            if (f !== -1) {
                f.found.lose(true);
                process.send({namespace: namespace, protocol: "player_disconnect", msg: f.index});
            }
        break;
    }
});

var lastSendTime = 0;
var gameover, scoreChange = false, firstUpdate = true;
function renderGame() {
    var time = now();
    deltaTime = time - lastTime;
    lastTime = time;
    
    //update
    scoreChange = localGame.update(deltaTime, leftDown, rightDown);
    if (scoreChange) { //have the scores changed? if so, resend
        process.send({namespace: namespace, protocol: "score", msg: createScoresPackage(localGame)});
    }
    
    //ask if we are done
    gameover = localGame.gameover();
    if (gameover) {
        console.dir(gameover);
        console.log("winner = "+gameover.playerName);
        process.send({namespace: namespace, protocol: "winner", extra: {
                users: users
            },
            msg: {
                playerName: gameover.playerName,
                playerIndex: gameover.playerIndex,
                id: gameId
            }}
        );
        console.log("exiting game server");
        process.exit(0);
    }
    
    //send
    if (time - lastSendTime >= 1000 || firstUpdate) {
        firstUpdate = false;
        process.send({namespace: namespace, protocol: "status", msg: createUpdatePackage(localGame)});
    }
    //process.nextTick(renderGame);
}

function createScoresPackage(game) {
    pack = [];
    
    for (var i = 0; i < game.players.length; i++) {
        pack.push({
            type: game.players[i].type,
            score: game.players[i].score,
            livesLeft: game.players[i].livesLeft
        });
    }
    
    return pack
}

function createUpdatePackage(game) {
    //pack should contain paddle positions, paddle sizes, and ball positions, ball lastHit, and eventually scores, 
    var i, hit, pack = {};
    
    pack.balls = [];
    for (i = 0; i < game.balls.length; i++) {
        if (game.balls[i].lastHit === 0) {
            hit = 0;
        } else {
            hit = game.balls[i].lastHit.playerId;
        }
        
        pack.balls.push({
            position: game.balls[i].position,
            vector: game.balls[i].vector,
            lastHit: hit //we rebuild the link using the id on the client
        });
    }
    
    pack.players = [];
    for (i = 0; i < game.players.length; i++) {
        pack.players.push({
            position: game.players[i].paddlePosition
        });
    }
    
    return pack;
}

/*
function renderGame() { //this name is just to be consistent with the client
    requestAnimationFrame(renderGame);
    
    var time = now();
    deltaTime = time - lastTime;
    lastTime = time;
    
    //update
    game.update(deltaTime, leftDown, rightDown);
    
}

/*
io.on('connection', function(socket) {
    console.log('a user connected');
    socket.on('data', function (args) {
        console.log(args);
    });
    socket.on('disconnect', function() {
        console.log('user disconnected');
    });
});
*/