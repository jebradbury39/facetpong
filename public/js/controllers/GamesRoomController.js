app.controller('GamesRoomController', ['$scope', '$http', '$rootScope', '$location', '$timeout', function($scope, $http, $rootScope, $location, $timeout) {
    $scope.socket = 0;
    $scope.gameId = "";
    $scope.usersOnline = [];
    
    if (typeof $rootScope.socket === 'undefined') {
        $location.url("");
        $scope.$apply();
        setTimeout(function() {
            window.location.reload();
        }, 500);
    }
    
    if ($rootScope.socket === 0) {
        $scope.socket = io();
        $rootScope.socket = $scope.socket;
    } else {
        $scope.socket = $rootScope.socket;
    }
    console.dir($scope.socket);
    $scope.displayCreate = "";
    
    $http.post('/api/gamelist', {userId: $rootScope.userId}).success(function(data) {
        $scope.gamelist = data;
        console.log("games: "+JSON.stringify(data));
        $scope.socket.emit('userId', $rootScope.userId);
    }).error(function(data) {
        console.log('Error: ' + data);
    });
    
    $http.get('/api/usersonline').success(function(data) {
        $scope.usersOnline = data;
    }).error(function(data) {
        console.log('Error: ' + data);
    });
    
    //$scope.socket.on('connect', function () {
        $scope.socket.emit('userId', $rootScope.userId);
        
        $scope.socket.on('validate', function () {
            $scope.socket.emit('userId', $rootScope.userId);
        });
        
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
        
        $scope.socket.on('gamelist', function (msg) {
            console.log("received prompt for gamelist");
            $http.post('/api/gamelist', {userId: $rootScope.userId}).success(function(data) {
                console.log("got gamelist");
                $scope.gamelist = data;
                //$scope.$apply();
                console.log("games: "+JSON.stringify(data));
                console.log("scope games: "+JSON.stringify($scope.gamelist));
            }).error(function(data) {
                console.log('Error: ' + data);
            });
        });
        
        $scope.socket.on('usersonline', function (msg) {
            $timeout(function() {
                $scope.usersOnline = msg;
            });
        });
        
        $scope.socket.on('startgame', function (data) {
            console.log("got start game prompt");
            $rootScope.inGame = data;
            //$scope.socket.disconnect("manual"); //we want to disconnect, but we need to tell the server why
            //$scope.socket.emit('manual_disconnect');
            //$scope.socket.emit('disconnect', "manual");
            $location.url("/game/");
            $scope.$apply();
        });
        
        $scope.$on('$destroy', function () {
            $scope.socket.removeAllListeners();
        });
    //});
    
    $scope.gameRequest = function (id) {
        console.log("game request to: "+id);
        id === $scope.gameId ? $scope.leaveGame(id) : $scope.joinGame(id);
    }
    
    $scope.joinGame = function (id) {
        console.log("joining game: "+id);
        var req = {
            gameId: id,
            userId: $rootScope.userId
        };
        $http.post('/api/join', req).success(function(data) {
            $rootScope.inGame = data.inGame;
            $scope.gameId = data.inGame.id;
            $scope.gamelist = data.gamelist;
            if (data.inGame !== 0) {
                $scope.displayCreate = "none";
            }
            console.log(data);
            if (data.status === "failure") {
                //alert(data.reason);
            }
        }).error(function(data) {
            console.error('Error: ' + data);
        });
    }
    
    $scope.leaveGame = function (id) {
        console.log("leaving game: "+id);
        var req = {
            gameId: id,
            userId: $rootScope.userId
        };
        $http.post('/api/leave', req).success(function(data) {
            $rootScope.inGame = {};
            $scope.gameId = 0;
            $scope.gamelist = data.gamelist;
            $scope.displayCreate = "";
            console.log(data);
            if (data.status === "failure") {
                //alert(data.reason);
            }
        }).error(function(data) {
            console.error('Error: ' + data);
        });
    }
    
    $scope.create = function (game) {
        game.sideLength = 300;
        game.userId = $rootScope.userId;
        
        /*alert(JSON.stringify(game), function () {
            console.log("callback");
        });*/
        $http.post('/api/create', game).success(function(data) {
            $rootScope.inGame = data.inGame;
            $scope.gameId = data.inGame.id;
            $scope.gamelist = data.gamelist;
            $scope.displayCreate = "none";
            console.log(data);
            if (data.status === "failure") {
                //alert(data.reason);
            }
        }).error(function(data) {
            console.error('Error: ' + data);
        });
    }
    
    SHOW = $rootScope;
}]);