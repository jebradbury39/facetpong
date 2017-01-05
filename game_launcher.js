var child_process = require("child_process");

//var io = require('socket.io').listen(80);
//io.of('/admins').emit('message', { message: "Hello admins!" });

module.exports = {
    launch: function (parentServer, attr, users, io, usersOnline, activeGames) {
        console.log("in launcher");
        var game = child_process.fork("./game.js");
        activeGames.push({id: attr.gameId, game: game});
        console.log("forked");
        game.on("message", parentServer.onGameServerMsg); //so parent can get messages
        console.dir(users);
        var init = {
            "type": "init",
            "attr": attr,
            "users": users
        };
        game.send(init); //send game init details to game server (like numPlayers)
        console.dir("sent init msg: "+init);
        /*
        var namespace = io.of("/"+attr.gameId);
        var namespaceStr = "/"+attr.gameId;
        namespace.on('connection', function(socket){
            console.log('someone connected to the game server');
            
            socket.on('userId', function (id) {
                console.log(id);
                var u = usersOnline.findBy("userId", id);
                if (u !== -1) {
                    if (u.gamesocket === 0) {
                        u.gamesocket = socket;
                        console.log("attached gamesocket to "+u.username);
                    }
                } else {
                    console.log("invalid user id = "+id);
                    socket.emit('status', "invalid user");
                }
            });
    
            socket.on('move', function (msg) {
                console.log("launcher: " + msg);
                msg = {
                    "type": "move",
                    "msg": msg
                };
                console.dir(msg);
                game.send(msg);
            });
            
            socket.on('disconnect', function(reason) {
                console.log("disconnect reason: "+reason);
                if (reason === 'ping timeout' || reason === "transport close") {
                    console.log('socket was disconnected by client inactive');
                    //let the server know so they can remove the game room connection
                } else {
                    console.log("manual disconnect");
                    socket.disconnect();
                    
                    var u = usersOnline.findBy("gamesocket", socket);
                    if (u !== -1) {
                        u.gamesocket = 0;
                    }
                    
                    if (Object.keys(namespace).length === 0) {
                        namespace.removeAllListeners(); // Remove all Listeners for the event emitter
                        delete io.nsps[namespaceStr]; // Remove from the server namespaces
                    }
                }
            });
            
            socket.on('game_disconnect', function() {
                console.log('user manually disconnected from the game');
                socket.disconnect();
                var u = usersOnline.findBy("gamesocket", socket);
                if (u !== -1) {
                    u.gamesocket = 0;
                }
            });
            
        });
        */
        return game;
    }
};