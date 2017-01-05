/*
Home Page - logon with just username
Games Room - list all games waiting for players, clicking on one will add you to that room
Game - the actual game
*/

var app = angular.module("AdvancedPongApp", ['ngRoute', 'ngResource', 'ngAnimate']);

app.config(function ($routeProvider) {
    $routeProvider.when('/', {
        controller: 'HomeController',
        templateUrl: 'views/home.html'
    }).when('/games_room/', {
        controller: 'GamesRoomController',
        templateUrl: "views/games_room.html"
    }).when('/game/', {
        controller: 'GameController',
        templateUrl: "views/game.html"
    }).otherwise({
        redirectTo: '/'
    });
});

app.filter('usernames', function() {
    return function(input) {
    
        var output = "Players: ";

        // Do filter work here
        for (var i = 0; i < input.length; i++) {
            output += input[i];
            if (i !== input.length - 1) {
                output += ", ";
            }
        }

        return output;

    }
});

app.filter('usersonline', function() {
    return function(input) {
    
        var output = "";

        // Do filter work here
        for (var i = 0; i < input.length; i++) {
            output += input[i];
            if (i !== input.length - 1) {
                output += "\n";
            }
        }

        return output;

    }
});
