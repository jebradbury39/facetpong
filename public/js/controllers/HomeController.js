app.controller('HomeController', ['$scope', '$http', '$location', '$rootScope', function($scope, $http, $location, $rootScope) {
    $rootScope.socket = 0;
    $scope.submit = function (user) {
        $http.post('/api/logon', user).success(function(data) {
            $rootScope.username = data.username;
            $rootScope.userId = data.userId;
            console.log(data);
            $location.url("/games_room/");
        }).error(function(data) {
            console.error('Error: ' + data);
        });
    };
}]);