app.controller('GameController', ['$scope', '$http', '$rootScope', '$location', function($scope, $http, $rootScope, $location) {
    $scope.gameSocket = $rootScope.socket;
    
    if (typeof $rootScope.socket === 'undefined') {
        $location.url("");
        $scope.$apply();
        setTimeout(function() {
            window.location.reload();
        }, 500);
    }
    console.log("opened game socket to " + ("/"+($rootScope.inGame.id)));
    
    //$scope.gameSocket.on('connect', function () {
        gameSocket = $scope.gameSocket;
        gameId = $rootScope.inGame.id;
        //$scope.gameSocket.emit('userId', $rootScope.userId);
        
        $scope.socket.on('error_status', function (msg) {
            alert("Error: "+msg+". This is likely because the server restarted, or because you reloaded the page. Click 'ok' to reconnect.", function() {
                console.log("callback");
                $location.url("");
                $scope.$apply();
                setTimeout(function() {
                    window.location.reload();
                }, 500);
            });
        });
        
        $scope.socket.on('disconnect', function () {
            alert("Error: Server disconnected. Click 'ok' to reconnect.", function() {
                console.log("callback");
                $location.url("");
                $scope.$apply();
                setTimeout(function() {
                    window.location.reload();
                }, 500);
            });
        });
        
        $scope.gameSocket.on('status', function (msg) {
            //console.log(msg);
            if (game !== 0) {
                unpackUpdate(msg);
            }
            //console.log("lag: "+(performance.now() - time));
            //time = performance.now();
        });
        
        $scope.gameSocket.on('player_disconnect', function (msg) {
            console.log("disconnected player: "+msg);
            if (game !== 0) {
                game.players[msg].lose(true);
            }
            //console.log("lag: "+(performance.now() - time));
            //time = performance.now();
        });
        
        $scope.gameSocket.on('score', function (msg) {
            for (var i = 0; i < msg.length; i++) {
                game.players[i].score = msg[i].score;
                game.players[i].livesLeft = msg[i].livesLeft;
                if (game.players[i].type !== msg[i].type && msg[i].type !== "paddle") {
                    game.players[i].lose(true);
                }
            }
        });
        
        $scope.gameSocket.on('winner', function (msg) {
            //stop the game and display who won, along with a timer to exit back to the game room
            pause();
            kill = true;
            //TODO: display winner. wipe all transforms and display banner
            console.log(JSON.stringify(msg));
            alert(msg.playerName + " won!",function () {
                $rootScope.inGame = 0;
                game = {};
                gameSocket = {};
                localPlayer = {};
                pause();
                $location.url("/games_room/");
                $scope.$apply();
            });
        });
        
        $scope.$on('$destroy', function () {
            $scope.gameSocket.removeAllListeners();
            window.onresize = function(){};
        });
        
    //});
    
    initCanvas();
    //$rootScope.userId = "id1";
    
    game = window.createGame(canvas, parseInt($rootScope.inGame.maxPlayers, 10) + parseInt($rootScope.inGame.numAIs, 10), 500, false, $rootScope.inGame.players, 
        $rootScope.inGame.playerNames, $rootScope.inGame.gametype, $rootScope.inGame.maxPoints, $rootScope.inGame.maxLives, $rootScope.inGame.numBalls);
    localPlayer = game.players.findBy("playerId", $rootScope.userId);//attach ref to player here
    localPlayer.paddleColor = "blue";
    
    console.log("created game: "+JSON.stringify(game));
    lastTime = performance.now();
    console.log("begin render");
    numHumans = $rootScope.inGame.maxPlayers;
    
    $scope.leaveGame = function () {
        if (localPlayer.type !== "paddle" || numHumans === 1) {
            //tell the server we are leaving
            gameSocket.emit('leave', {gameId: gameId, userId: localPlayer.playerId});
            pause();
            kill = true;
            
            $rootScope.inGame = 0;
            game = {};
            gameSocket = {};
            localPlayer = {};
            pause();
            $location.url("/games_room/");
            $scope.$apply();
        }
    }
    
    resizeCanvas(canvas, context, localPlayer, game);
    window.onresize = function () {
        console.log("resized window");
        resizeCanvas(canvas, context, localPlayer, game);
    };
    
    renderGame();
}]);