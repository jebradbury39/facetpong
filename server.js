"use strict"

// set up ========================
var express = require('express');
var app = express();                               // create our app w/ express
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io')(server);

//var io = require('socket.io')(server);
var morgan = require('morgan');             // log requests to the console (express4)
var bodyParser = require('body-parser');    // pull information from HTML POST (express4)
var methodOverride = require('method-override'); // simulate DELETE and PUT (express4)
var shortid = require('shortid');

//custom libs
var launcher = require("./game_launcher");
var pong = require('./public/pong');

// configuration =================

app.use(express.static(__dirname + '/public'));                 // set the static files location /public/img will be /img for users
//app.use(morgan('dev'));                                         // log every request to the console
app.use(bodyParser.urlencoded({'extended':'true'}));            // parse application/x-www-form-urlencoded
app.use(bodyParser.json());                                     // parse application/json
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
app.use(methodOverride());

////////helper functions
Array.prototype.findBy = function (searchBy, equals) {
    for (var i = 0; i < this.length; i++) {
        if (this[i][searchBy] === equals || (searchBy === "" && this[i] === equals)) {
            return this[i];
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

// listen (start app with node server.js) ======================================

server.listen(process.env.PORT || 8080, function () {
    console.log("App listening on port " + (process.env.PORT || 8080) + " at "+(new Date().toString()));
});

// routes ======================================================================
var gamelist = [];

var activeGames = [];

var usersOnline = [];

var logonServer = {
    onGameServerMsg: function (msg) {
        //console.log(msg);
        if (msg.protocol === "winner") {
            //clean up the game
            console.log("cleaning up game: "+msg.msg.id);
            activeGames.removeBy("id", msg.msg.id);
            console.dir(msg.msg);
        }
        if (msg.protocol === "player_leave") {
            console.log("searching for leaving player: "+msg.msg);
            var u = usersOnline.findBy("userId", msg.msg);
            console.log("usersOnline: "+usersOnline.length+" found leaving player: "+u);
            if (u !== -1) {
                u.socket.leave(msg.namespace);
            }
        }
        //io.of(msg.namespace).emit(msg.protocol, msg.msg);
        io.sockets.in(msg.namespace).emit(msg.protocol, msg.msg);
    }
};

function packageUsersOnline(users) {
    //just send an array of usernames
    var list = [];
    for (var i = 0; i < users.length; i++) {
        list.push(users[i].username);
    }
    
    return list;
}

function packageGame(game, id) {
    var newPlayers = [];
    console.log("packaging game "+game.id+" for "+id);
    for (var j = 0; j < game.players.length; j++) {
        if (game.players[j] === id) {
            newPlayers.push(id);
        } else {
            newPlayers.push(shortid.generate());
        }
    }
    
    return {
        currentPlayers: game.currentPlayers,
        maxPlayers: game.maxPlayers,
        id: game.id,
        players: newPlayers,
        playerNames: game.playerNames,
        gametype: game.gametype,
        maxPoints: game.maxPoints,
        maxLives: game.maxLives,
        numAIs: game.numAIs,
        numBalls: game.numBalls
    };
}

function packageGamelist(list, id) {
    //strip out the ids except for the player we are sending to and send
    var pkg = [];
    console.log("start packaging gamelist");
    for (var i = 0; i < list.length; i++) {
        pkg.push(packageGame(list[i], id));
    }
    console.dir(pkg);
    return pkg;
}

// api ---------------------------------------------------------------------
app.get('/api/usersonline', function(req, res) {
    res.json(packageUsersOnline(usersOnline));
});

// get all waiting games
app.post('/api/gamelist', function(req, res) {
    console.log(req.body.userId+" is requesting the gamelist");
    console.dir(req.body);
    res.json(packageGamelist(gamelist, req.body.userId)); // return all games in JSON format
});

// create username and userId. 
app.post('/api/logon', function(req, res) { //(in, out)

    console.log("user: "+req.body.username);
    var uid = shortid.generate();
    usersOnline.push({
        username: req.body.username,
        userId: uid,
        socket: 0
    });
    console.dir(usersOnline);
    
    res.json({
        "status": "success",
        username: req.body.username,
        userId: uid
    });
});

// create game
app.post('/api/create', function(req, res) { //(in, out)
    console.log("game: players: "+req.body.numPlayers+" side: "+req.body.sideLength+" uid: "+req.body.userId);
    var valid = true, newGame, pkg;
    for (var i = 0; i < gamelist.length; i++) {
        newGame = gamelist[i].players.findBy("", req.body.userId);
        if (newGame !== -1) {
            pkg = packageGamelist(gamelist, req.body.userId);
            res.json({
                "status":"failure", 
                reason: "Already in game",
                gamelist: pkg,
                inGame: packageGame(newGame, req.body.userId)
            });
            valid = false;
        }
    }
    if (valid && usersOnline.findBy("userId", req.body.userId) !== -1) {
        newGame = {
            players: [req.body.userId],
            currentPlayers: 1,
            maxPlayers: isNaN(req.body.numPlayers) ? 0 : parseInt(req.body.numPlayers, 10),
            id: shortid.generate(),
            playerNames: [usersOnline.findBy("userId", req.body.userId).username],
            gametype: req.body.gametype,
            maxPoints: req.body.maxPoints,
            maxLives: req.body.maxLives,
            numAIs: isNaN(req.body.numAIs) ? 0 : parseInt(req.body.numAIs, 10),
            numBalls: isNaN(req.body.numBalls) ? 1 : parseInt(req.body.numBalls, 10)
        };
        //if just 1 human player, don't add the game to the gamelist. just run it locally to free resources.
        if (newGame.maxPlayers <= 1) {
            var u = usersOnline.findBy("userId", newGame.players[0]);
            u.socket.emit('startgame', packageGame(newGame, u.userId));
        }
        
        if (newGame.maxPlayers > 1) {
            gamelist.push(newGame);
            io.sockets.emit('gamelist'); //tell the client to request the updated gamelist. this forces them to provide their id
        }
        pkg = packageGamelist(gamelist, req.body.userId);
        
        res.json({
            "status":"success",
            gamelist: pkg,
            inGame: newGame
        });
    }
});

// join a game
app.post('/api/join', function(req, res) {
    var g = gamelist.findBy("id", req.body.gameId);
    console.log("user: "+req.body.userId+" req join game: "+req.body.gameId);
    if (g === -1) {
        res.json({
            "status": "failure",
            reason: "game not found",
            gamelist: packageGamelist(gamelist, req.body.userId),
            inGame: 0
        });
    } else {
        console.log("joining game");
        //check if the user is in ANY games
        var cont = true;
        for (var t = 0; t < gamelist.length; t++) {
            if (gamelist[t].players.findBy("", req.body.userId) !== -1) {
                cont = false;
                break;
            }
        }
        if (cont) {
            g.players.push(req.body.userId);
            g.playerNames.push(usersOnline.findBy("userId", req.body.userId).username);
            g.currentPlayers++;
            console.log(g.currentPlayers+" / "+g.maxPlayers+" : "+(g.currentPlayers === g.maxPlayers));
            io.sockets.emit('gamelist'); //push changes
            if (g.currentPlayers === g.maxPlayers) {
                //remove the game from the waiting list and fork it
                
                console.log("start game");
                var playingUsers = [];
                var u;
                for (var i = 0; i < g.players.length; i++) {
                    u = usersOnline.findBy("userId", g.players[i]);
                    playingUsers.push({
                        username: u.username,
                        userId: u.userId,
                        socket: 0
                    });
                    
                    u.socket.emit('startgame', packageGame(g, u.userId));
                    //add to the game room
                    u.socket.join(g.id);
                }
                
                console.log("users notified");
                
                launcher.launch(logonServer,{
                    numPlayers: parseInt(g.maxPlayers, 10) + parseInt(g.numAIs, 10), 
                    sideLength: 500, 
                    gameId: g.id, 
                    gametype: g.gametype, 
                    maxPoints: g.maxPoints,
                    maxLives: g.maxLives,
                    numBalls: g.numBalls
                }, playingUsers, io, usersOnline, activeGames);
                
                console.log("game server launched");
                gamelist.removeBy("id", g.id);
                console.log("game removed from list");
            }
        }
        
        res.json({
            "status":"success",
            gamelist: packageGamelist(gamelist, req.body.userId),
            inGame: packageGame(g, req.body.userId)
        });
    }
});

// leave a game
app.post('/api/leave', function(req, res) {
    var g = gamelist.findBy("id", req.body.gameId);
    console.log("user: "+req.body.userId+" req leave game: "+req.body.gameId);
    if (g === -1) {
        //game does not exist
        res.json({
            "status": "failure",
            reason: "game not found",
            gamelist: packageGamelist(gamelist, req.body.userId),
            inGame: 0
        });
    } else {
        //now check if the player is in the game
        var u = g.players.removeBy("", req.body.userId);
        if (u !== -1) {
            //the player was in the game, now remove their name and send update. if the game has no players left, remove it
            g.playerNames.splice(u.index, 1);
            g.currentPlayers--;
            if (g.currentPlayers <= 0) {
                gamelist.removeBy("id", g.id);
            }
            io.sockets.emit('gamelist'); //push changes
        }
        
        res.json({
            "status":"success",
            gamelist: packageGamelist(gamelist, req.body.userId)
        });
    }
});

// application -------------------------------------------------------------
app.get('*', function(req, res) {
    res.sendfile('./public/index.html'); // load the home page
});

//socket to manage gamelist updates after initial retrieval
io.on('connection', function(socket) {
    console.log('a user connected');
    //ask them to provide a userId so we can verify them
    socket.emit('validate');
    io.sockets.emit('usersonline', packageUsersOnline(usersOnline));
    
    socket.on('data', function (msg) {
        console.log(msg);
    });
    socket.on('userId', function (id) {
        console.log(id);
        var u = usersOnline.findBy("userId", id);
        if (u !== -1) {
            if (u.socket === 0) {
                u.socket = socket;
                console.log("attached socket to "+u.username);
            }
        } else {
            console.log("invalid user id = "+id);
            socket.emit('error_status', "invalid user");
        }
    });
    
    socket.on('disconnect', function(reason) {
        console.log("disconnect reason: "+reason);
        
        var u = usersOnline.removeBy("socket", socket);
        if (u !== -1) {
            console.log("removing: ");
            console.dir(u);
            var _userId = u.removed[0].userId;
            console.log("userid: "+_userId);
            for (var i = 0; i < gamelist.length; i++) {
                console.log("userid: "+_userId);
                var cu = gamelist[i].players.removeBy("", _userId);
                if (cu !== -1) {
                    console.dir(gamelist[i].playerNames);
                    console.log("removing username @ "+cu.index);
                    gamelist[i].playerNames.splice(cu.index, 1); //we cant remove by username since it is not unique
                    console.dir(gamelist[i].playerNames);
                    gamelist[i].currentPlayers = gamelist[i].players.length;
                }
                if (gamelist[i].players.length === 0) {
                    gamelist.splice(i, 1);
                    i--;
                    console.log("removed game");
                }
                console.log("removed from game: "+gamelist[i].id);
            }
            
            for (i = 0; i < activeGames.length; i++) {
                activeGames[i].game.send({
                    "type": "player_disconnect",
                    userId: _userId
                });
            }
            io.sockets.emit('gamelist'); //push changes
            if (u !== -1) {
                console.log("removed: ");
                console.dir(u);
            } else {
                console.log("remove failed: user not found");
            }
        }
        
        io.sockets.emit('usersonline', packageUsersOnline(usersOnline));
    });
    
    socket.on('move', function (msg) {
        //console.log("launcher: " + msg);
        var newmsg = {
            "type": "move",
            "msg": msg
        };
        //console.dir(newmsg);
        var target = activeGames.findBy("id", msg.gameId);
        if (target !== -1) {
            target.game.send(newmsg);
        }
    });
    
    socket.on('leave', function (msg) {
        var target = activeGames.findBy("id", msg.gameId);
        console.log("player: "+msg.userId+" wants to leave game: "+msg.gameId);
        if (target !== -1) {
            target.game.send({
                "type": "leave",
                msg: msg
            });
        }
    });
    
});

/////////////////////server maint tools
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function(data) {
    data = data.toString().trim();
    if (data === "users") {
        console.dir(usersOnline);
    }
    if (data === "games") {
        console.dir(gamelist);
    }
    if (data === "activegames") {
        console.dir(activeGames);
    }
    if (data === "rs") {
        console.log("restarting");
        io.sockets.emit('error_status', "invalid user");
    }
});

// Pre-exit scripts
var preExit = [];

// Catch exit
process.stdin.resume ();
process.on ('exit', function (code) {
    var i;

    console.log ('Process exit');

    for (i = 0; i < preExit.length; i++) {
        preExit [i] (code);
    }

    process.exit (code);
});

// Catch CTRL+C
process.on ('SIGINT', function () {
    console.log ('\nCTRL+C...');
    process.exit (0);
});

// Catch restart
process.on ('SIGUSR2', function () {
    console.log ('\nrestart...');
    process.exit (0);
});

// Catch uncaught exception
process.on ('uncaughtException', function (err) {
    console.dir (err, { depth: null });
    process.exit (1);
});

// Add pre-exit script
preExit.push (function (code) {
    console.log ('Whoa! Exit code %d, cleaning up...', code);
    io.sockets.emit('error_status', "invalid user");
});

/////error handling to disable stack trace
app.use(function(err, req, res, next){
    console.error(err.stack);
    res.status(500);
    res.json({error: 'error'});
});
