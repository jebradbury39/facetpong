var SAT = require('sat');

if(typeof window === 'undefined'){
    window = {};
}

/** @define {boolean} */
var DEBUG = false;
var SCORE_CHANGED = 2; //ball left arena and scores changed
var BALL_LEFT_ARENA = 1; //ball left the arena but no scores changed
var BALL_IN_ARENA = 0; //the ball is still in the arena
var MAX_STRIKES = 5;
//////////////////end "preprocessor"

var TO_RADIANS = Math.PI / 180;
var TO_DEGREES = 180 / Math.PI;
var pi = Math.PI;

function subtract(vA, vB) {
    return [vA[0] - vB[0], vA[1] - vB[1]];
}

function dot(vA, vB) {
    return (vA[0] * vB[0]) + (vA[1] * vB[1]);
}

function component(vA, vB) { //returns component of A along B = (A dot B) / mag(B)
    return ((vA[0] * vB[0]) + (vA[1] * vB[1])) / magnitude(vB);
}

function magnitude(v) {
    return Math.sqrt((v[0] * v[0]) + (v[1] * v[1]));
}

//optimized distance comparision
function distanceSquared(vA, vB) {
    var x = vB[0] - vA[0];
    var y = vB[1] - vA[1];
    
    return (x * x) + (y * y);
}

function normalize(v) {
    var mag = magnitude(v);
    return [v[0] / mag, v[1] / mag];
}

function reflection(v, N) {
    //v1 = v - 2 * dot(v, N) * N
    var dp = dot(v, N);
    return [v[0] - (2 * dp * N[0]), v[1] - (2 * dp * N[1])];
}
//alert(reflection([1,-1], [0, 1]));

function angleBetween(vA, vB) {
    return (Math.atan2(vB[1], vB[0]) - Math.atan2(vA[1], vA[0])) * TO_DEGREES;
}
//console.log(angleBetween([0,1], [1,0]));
//console.log(Math.atan2(0, 1));

function rotatedVector(v, degrees, ccw) {
    var rads = degrees * TO_RADIANS;
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

//load SAT constructors
var V = SAT.Vector,
    C = SAT.Circle,
    P = SAT.Polygon;
 
//last player to touch the ball gets the point
//players are knocked out until one left
//all points are 2 element arrays
//gametype = "points" || "elimination"
function Board(gametype, maxPoints, balls, polygon, players) {
    this.drawOrigin = [0, 0]; //this is with rotation
    this.drawTextOrigin = [0, 0];
    this.rotation = 0; //for resize transform
    this.scale = [1, 1]; //we need this for the text too
    this.gametype = gametype;
    this.maxPoints = maxPoints; //First person to this # of points wins
    this.balls = balls;
    this.polyBorder = polygon;
    this.players = players;
    this.alive;
}

Board.prototype.playersLeftAlive = function () {
    var sum = 0;
    var last;
    for (var i = 0; i < this.players.length; i++) {
        if (this.players[i].type !== "object" && !this.players[i].special && !this.players[i].controllerAI) {
            sum++;
            last = this.players[i].playerName;
        }
    }
    return {
        sum: sum,
        name: last
    };
}

Board.prototype.gameover = function () {
    this.alive = this.playersLeftAlive();
    if (this.gametype === "points") {
        for (var i = 0; i < this.players.length; i++) {
            if (this.players[i].score >= this.maxPoints) { //>= just for safety
                return {
                    playerName: this.players[i].playerName, 
                    playerId: this.players[i].playerId,
                    playerIndex: i
                };
            }
        }
    } else if (this.gametype === "elimination") {
        if (this.alive === 1) {
            for (i = 0; i < this.players.length; i++) {
                if (this.players[i].type !== "object" && !this.players[i].special) {
                    return {
                        playerName: this.players[i].playerName, 
                        playerId: this.players[i].playerId,
                        playerIndex: i
                    };
                }
            }
        }
    }
    
    if (this.alive.sum <= 1) {
        return {
            playerName: this.alive.name, 
            playerId: -1,
            playerIndex: -1
        };
    }
    return false;
}

Board.prototype.draw = function (context, deltaTime) {
    context.beginPath();
    context.moveTo(this.polyBorder[0][0], this.polyBorder[0][1]);
    for (var i = 1; i < this.polyBorder.length; i++) {
        context.lineTo(this.polyBorder[i][0], this.polyBorder[i][1]);
    }
    context.stroke();
    context.closePath();
    
    for (var n = 0; n < this.players.length; n++) {
        this.players[n].draw(context, this.gametype, this.scale, this.drawTextOrigin);
    }
    
    for (var b = 0; b < this.balls.length; b++) {
        this.balls[b].draw(context);
        this.balls[b].collideSound();
    }
}

Board.prototype.update = function (deltaTime) {
    var updateScores = false; //do we need to send an update?
    
    for (var n = 0; n < this.players.length; n++) {
        this.players[n].ai(this.balls, deltaTime);
        if (this.players[n].leftDown) {
            this.players[n].movePaddle(deltaTime / 1000);
        }
        if (this.players[n].rightDown) {
            this.players[n].movePaddle(-(deltaTime / 1000));
        }
    }
    
    for (var b = 0; b < this.balls.length; b++) {
        if (this.balls[b].update(deltaTime, this.players, this.polyBorder, this.gametype) === SCORE_CHANGED) {
            updateScores = true;
        }
    }
    
    return updateScores;
}

Board.prototype.transformPlayerText = function (canvas, radians) {
    for (var i = 0; i < this.players.length; i++) {
        console.log("transforming: "+this.players[i].playerName);
        this.players[i].transformTextPosition(canvas, radians);
    }
}

function Ball(radius, position, vector, color, server) {
    this.type = "ball";
    this.radius = radius;
    this.position = position;
    this.vector = vector;
    this.lastHit = 0;
    this.color = color;
    this.free = true;
    this.initPosition = [position[0], position[1]];
    this.maxSpeed = 250;
    this.physicsMaterial = new C(new V(position[0], position[1]), radius);
    this.soundQueued = 0;
    this.audio = 0;
}

Ball.prototype.collideSound = function () {
    if (this.audio === 0) {
        this.audio = new Audio('./sound/collision.mp3');
    }
    //console.log("playing sound: "+this.soundQueued);
    if (this.soundQueued > 0) {
        this.audio.currentTime = 0;
        this.audio.play(); //we arent inc on purpose for now
        this.soundQueued = 0;
    }
};

Ball.prototype.update = function (deltaTime, objects, polygon, gametype) {
    var wentOutOn = 0;
    
    if (!insidePolygon(polygon, this.position)) {
        var lost = false;
        for (var t = 0; t < objects.length; t++) {
            if (objects[t].type === "paddle") {
                if (insidePolygon(objects[t].court, this.position)) {
                    wentOutOn = objects[t];
                    if (gametype === "elimination") {
                        objects[t].lose(false);
                        lost = true;
                    } else {
                        objects[t].strikes++;
                        if (objects[t].strikes > MAX_STRIKES) {
                            objects[t].lose(false);
                            lost = true;
                        }
                        //finish resetting other player strikes
                        for (var tt = t + 1; tt < objects.length; tt++) {
                            if (objects[tt].type === "paddle") {
                                objects[tt].strikes = 0;
                            }
                        }
                    }
                    //console.log("went out on: "+objects[t].playerName);
                    break;
                } else {
                    objects[t].strikes = 0;
                }
            }
        }
            
        this.position = [this.initPosition[0], this.initPosition[1]];
        if (this.lastHit !== 0) {
            if (wentOutOn !== 0) {
                if (wentOutOn.playerId !== this.lastHit.playerId) {
                    this.lastHit.score++;
                }
            }
            this.lastHit = 0;
            return SCORE_CHANGED;
        }
        return lost ? SCORE_CHANGED : BALL_LEFT_ARENA;
    }
    
    this.position[0] += this.vector[0] * deltaTime / 1000;
    this.position[1] += this.vector[1] * deltaTime / 1000;
    
    if (DEBUG) {
        context.beginPath();
        context.strokeStyle = "red";
        context.moveTo(this.position[0], this.position[1]);
        context.lineTo(this.position[0] + this.vector[0], this.position[1] + this.vector[1]);
        context.stroke();
    }
    
    this.physicsMaterial.pos.x = this.position[0];
    this.physicsMaterial.pos.y = this.position[1];
    
    var response = new SAT.Response();
    
    var collided = false;
    var obj;
    for (var i = 0; i < objects.length; i++) {
        response.clear();
        
        if (SAT.testPolygonCircle(objects[i].physicsMaterial, this.physicsMaterial, response)) {
            collided = true;
            obj = objects[i];
            break;
        }
    }
    if (!this.free) {
        this.free = !collided;
    }
    this.free = true;
    if (collided && this.free) {
        //console.log("resolve collision : "+JSON.stringify(obj));
        this.free = false;
        this.soundQueued++;
        this.resolvePaddleCollision(deltaTime, obj);
        if (obj.type === "paddle") {
            this.lastHit = obj;
        }
    }
    return BALL_IN_ARENA;
}

Ball.prototype.resolvePaddleCollision = function (deltaTime, obj) {
    //total is half paddle length + ball radius
    //add speed at each bounce
    var angle;
    //vector from paddle center to ball center
    var vectorPtoB = [this.position[0] - obj.paddlePosition[0], this.position[1] - obj.paddlePosition[1]];
    var saveSpeed = magnitude(this.vector);
    
    //vector along paddle
    var len = (obj.paddleLength / obj.sideLength) * (obj.paddleDeltaRange[1] - obj.paddleDeltaRange[0]);
    var x1 = (obj.paddleVector[0] * (obj.paddleDeltaRange[0] + len)) * 0.5;
    var y1 = (obj.paddleVector[1] * (obj.paddleDeltaRange[0] + len)) * 0.5;
    
    var dp = component(vectorPtoB, [x1, y1]);
    var rev = 1;
    if (dp < 0) {
        dp = component(vectorPtoB, [-x1, -y1]);
        rev = -1;
    }
    if (obj.type === "object") {
        //bounce by angle of incidence
        //angle = 90 - (Math.acos(dp / magnitude(vectorPtoB)) * TO_DEGREES);
        this.vector = reflection(this.vector, obj.normal);
        //console.log(angle);
    }
    
    if (obj.type === "paddle") {
        //artifical bounce for gameplay
        var ratioDP = dp / ((obj.paddleLength / 2) + this.radius);
    
        angle = ((obj.angleRange[1] - obj.angleRange[0]) * ratioDP) + obj.angleRange[0];
    
    
        var incSpeed = 1.1 * saveSpeed;
        if (incSpeed > this.maxSpeed) {
            incSpeed = this.maxSpeed;
        }
        
        var norm = [obj.normal[0] * incSpeed, obj.normal[1] * incSpeed];
        
        this.vector = rotatedVector(norm, angle, rev > 0);
    }
    if (DEBUG) {
        context.beginPath();
        context.strokeStyle = "purple";
        context.moveTo(t.paddlePosition[0], t.paddlePosition[1]);
        context.lineTo(norm[0]+ t.paddlePosition[0], norm[1]+ t.paddlePosition[1]);
        console.log("angle: "+angle+" ccw: "+(rev < 0));
        context.stroke();
        
        context.beginPath();
        context.strokeStyle = "orange";
        context.moveTo(t.paddlePosition[0], t.paddlePosition[1]);
        context.lineTo(t.paddlePosition[0] + this.vector[0], t.paddlePosition[1] + this.vector[1]);
        context.stroke();
        
        context.beginPath();
        context.strokeStyle = "red";
        context.moveTo(this.position[0], this.position[1]);
        context.lineTo(this.position[0] + this.vector[0], this.position[1] + this.vector[1]);
        context.stroke();
        
        //pause();
        context.strokeStyle = "black";
    }
    
    //update
    this.position[0] += this.vector[0] * deltaTime / 1000;
    this.position[1] += this.vector[1] * deltaTime / 1000;
    this.physicsMaterial.pos.x = this.position[0];
    this.physicsMaterial.pos.y = this.position[1];
    
}

/*
C.prototype.draw = function (ctx) {
    ctx.fillStyle = "green";
    //console.log(JSON.stringify(this));
    //ctx.save();
    //ctx.translate(this.pos.x, this.pos.y);
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.r, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    //ctx.restore();
};
*/

Ball.prototype.draw = function (context) {
    context.beginPath();
    context.arc(this.position[0], this.position[1], this.radius, 0, 2*Math.PI);
    //var grd=context.createRadialGradient(this.position[0],this.position[1],5, this.position[0],this.position[1],10);
    //grd.addColorStop(0,"red");
    //grd.addColorStop(1,"rgba(255, 255, 255, 0)");
    //context.fillStyle = grd;
    //context.fillRect(this.position[0] - this.radius, this.position[1] - this.radius, this.radius * 2, this.radius * 2);
    
    context.fillStyle = this.color;
    context.fill();
    context.closePath();
}
/*
P.prototype.draw = function (ctx) {
    ctx.fillStyle = "green";
    var points = this.points;
    var i = points.length;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    while (i--) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
};
*/

function Player(id, name, paddleVector, paddleVectorStart, paddleDeltaRange, paddleDelta, paddlePosition, paddleColor, paddleLength, sideLength, special, isAI, maxLives) {
    this.type = "paddle";
    this.controllerAI = isAI;
    this.aiMoveTimer = 0; //when the timer goes to 0, the ai may make a move. This is to prevent the hummingbird effect and lessens the load
    this.aiResetTimer = 400; //average human response time is about 0.5 seconds, so we give the ai 0.4 seconds
    this.special = special; //for the special 2 player case, the two walls should not display any score
    this.leftDown = false;
    this.rightDown = false;
    this.playerId = id;
    this.playerName = name;
    this.paddleHeight = 10;
    this.paddleVector = paddleVector;
    this.paddleVectorStart = paddleVectorStart;
    this.paddleDeltaRange = paddleDeltaRange;
    this.paddleDelta = paddleDelta;
    this.paddlePosition = paddlePosition;
    this.paddleSpeed = 0.3;
    this.paddleColor = paddleColor;
    this.paddleLength = paddleLength;
    this.sideLength = sideLength;
    this.angleRange = [10, 75];
    this.score = 0;
    this.livesLeft = maxLives; //for elimination matches
    this.strikes = 0; //to determine inactivity
    
    //////////////////////////////////////init paddle position
    var len = (this.paddleLength / this.sideLength) * (this.paddleDeltaRange[1] - this.paddleDeltaRange[0]);
    var len2 = len / 2;
    if (this.paddleDelta > this.paddleDeltaRange[1] - len2) {
        this.paddleDelta = this.paddleDeltaRange[1] - len2;
    }
    if (this.paddleDelta < this.paddleDeltaRange[0] + len2) {
        this.paddleDelta = this.paddleDeltaRange[0] + len2;
    }

    this.paddlePosition = [this.paddleVectorStart[0] + (this.paddleVector[0] * this.paddleDelta), this.paddleVectorStart[1] + (this.paddleVector[1] * this.paddleDelta)];
    
    ///////////////////////////////////////init unit normal vector
    var mag = magnitude(paddleVector);
    this.normal = [-this.paddleVector[1] / mag, this.paddleVector[0] / mag];
    
    /////////////////////////////////////init where to start drawing the username and score, align by x
    this.drawTextPosition = [this.paddlePosition[0] + (this.normal[0] * (-20)), this.paddlePosition[1] + (this.normal[1] * (-20))];
    this.textAlign = this.normal[0] > 0 ? "right" : "left";
    if (this.normal[0] === 0) {
        this.textAlign = "center";
    }
    
    /////////////////////////////////////////compute material
    
    var height = this.paddleHeight;
    var relativeVertices = [];
    
    var startX = this.paddlePosition[0];
    var startY = this.paddlePosition[1];
    
    var x1 = -(this.paddleVector[0] * (this.paddleDeltaRange[0] + len)) * 0.5;
    var y1 = -(this.paddleVector[1] * (this.paddleDeltaRange[0] + len)) * 0.5;
    
    relativeVertices.push(new V(Math.floor(-x1), Math.floor(-y1)));
    relativeVertices.push(new V(Math.floor(x1), Math.floor(y1)));
    
    var v2 = [this.normal[0] * this.paddleHeight, this.normal[1] * this.paddleHeight];
    
    relativeVertices.push(new V(Math.floor(x1 + v2[0]), Math.floor(y1 + v2[1])));
    relativeVertices.push(new V(Math.floor(-x1 + v2[0]), Math.floor(-y1 + v2[1])));
    
    relativeVertices.reverse();
    
    this.physicsMaterial = new P(new V(Math.floor(startX), Math.floor(startY)), relativeVertices);
    
    /////////////////////////////////////////////compute the court
    startX += v2[0] / 2; //move the court to perfectly center the line
    startY += v2[1] / 2;
    x1 = -(this.paddleVector[0]) * 0.5;
    y1 = -(this.paddleVector[1]) * 0.5;
    this.court = [];
    this.court.push([Math.floor(startX - x1), Math.floor(startY - y1)]);
    this.court.push([Math.floor(startX + x1), Math.floor(startY + y1)]);
    v2 = [-v2[0], -v2[1]]; //we want the court to go mostly the other way
    this.court.push([Math.floor(startX + x1 + v2[0]), Math.floor(startY + y1 + v2[1])]);
    this.court.push([Math.floor(startX - x1 + v2[0]), Math.floor(startY - y1 + v2[1])]);
    this.court.reverse();
}

Player.prototype.ai = function (balls, deltaTime) {
    if (!this.controllerAI || this.type !== "paddle") {
        return;
    }
    
    if (this.aiMoveTimer > 0) {
        if (this.aiMoveTimer >= deltaTime) {
            this.aiMoveTimer -= deltaTime;
            return;
        }
        this.aiMoveTimer = this.aiResetTimer - deltaTime;
        while (this.aiMoveTimer < 0) {
            this.aiMoveTimer += this.aiResetTimer;
        }
    }
    
    //TODO: track the closest ball instead of the first one
    var track = balls[0];
    var dister, dist2 = distanceSquared(this.paddlePosition, track.position);
    for (var b = 1; b < balls.length; b++) {
        dister = distanceSquared(this.paddlePosition, balls[b].position);
        if (dister < dist2) {
            track = balls[b];
        }
    }
    var vectorPtoB = [track.position[0] - this.paddlePosition[0], track.position[1] - this.paddlePosition[1]];
    
    //vector along paddle
    var len = (this.paddleLength / this.sideLength) * (this.paddleDeltaRange[1] - this.paddleDeltaRange[0]);
    var x1 = (this.paddleVector[0] * (this.paddleDeltaRange[0] + len)) * 0.5;
    var y1 = (this.paddleVector[1] * (this.paddleDeltaRange[0] + len)) * 0.5;
    
    var dp = component(vectorPtoB, [x1, y1]); //get the component of our paddle on the vector to the ball. Move in the direction which will minimize this component
    var leftRight = -1; //1 is right, -1 is left
    if (dp < 0) {
        dp = component(vectorPtoB, [-x1, -y1]);
        leftRight = 1;
    }
    
    if (leftRight < 0) {
        this.leftDown = true;
        this.rightDown = false;
    } else {
        this.leftDown = false;
        this.rightDown = true;
    }
    
    /*var ratioDP = dp / ((this.paddleLength / 2) + track.radius);

    angle = ((this.angleRange[1] - this.angleRange[0]) * ratioDP) + this.angleRange[0];

    var incSpeed = 1.1 * saveSpeed;
    if (incSpeed > this.maxSpeed) {
        incSpeed = this.maxSpeed;
    }
    
    var norm = [obj.normal[0] * incSpeed, obj.normal[1] * incSpeed];
    
    this.vector = rotatedVector(norm, angle, rev > 0);*/
}

Player.prototype.movePaddle = function (delta) {
    this.paddleDelta += this.paddleSpeed * delta;
    
    var len = (this.paddleLength / this.sideLength) * (this.paddleDeltaRange[1] - this.paddleDeltaRange[0]) * 0.5;
    if (this.paddleDelta > this.paddleDeltaRange[1] - len) {
        this.paddleDelta = this.paddleDeltaRange[1] - len;
    }
    if (this.paddleDelta < this.paddleDeltaRange[0] + len) {
        this.paddleDelta = this.paddleDeltaRange[0] + len;
    }

    this.paddlePosition = [this.paddleVectorStart[0] + (this.paddleVector[0] * this.paddleDelta), this.paddleVectorStart[1] + (this.paddleVector[1] * this.paddleDelta)];
    
    this.physicsMaterial.pos.x = this.paddlePosition[0];
    this.physicsMaterial.pos.y = this.paddlePosition[1];
}

Player.prototype.draw = function (context, gametype, scale, textOrigin) {
    var len = (this.paddleLength / this.sideLength) * (this.paddleDeltaRange[1] - this.paddleDeltaRange[0]);
    var vecLen1 = (this.paddleVector[0] * (this.paddleDeltaRange[0] + len)) * 0.5,
        vecLen2 = (this.paddleVector[1] * (this.paddleDeltaRange[0] + len)) * 0.5;
    
    var startX = this.paddlePosition[0];
    var startY = this.paddlePosition[1];
    
    var x1 = startX - vecLen1;
    var y1 = startY - vecLen2;
    var x2 = startX + vecLen1;
    var y2 = startY + vecLen2;
    
    var v2 = [this.normal[0] * this.paddleHeight, this.normal[1] * this.paddleHeight];
    
    context.beginPath();
    context.moveTo(x2, y2);
    context.lineTo(x1, y1);
    context.lineTo(x1 + v2[0], y1 + v2[1]);
    context.lineTo(x2 + v2[0], y2 + v2[1]);
    context.lineTo(x2, y2);
    
    context.fillStyle = this.paddleColor;
    context.fill();
    context.closePath();
    
    //draw the username: score
    if (!this.special) {
        context.textAlign = this.textAlign;
        context.font = "25px Arial";
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.translate(canvas.width / 2, canvas.height / 2);
        context.scale(scale[0], scale[1]);
        context.translate(textOrigin[0] / scale[0], textOrigin[1] / scale[1]);
        
        var txt = this.playerName+": "+this.score;
        if (gametype === "elimination") {
            txt += " Lives: "+this.livesLeft;
        }
        context.fillText(txt, this.drawTextPosition[0], this.drawTextPosition[1]);
        //context.translate(-canvas.width / 2, -canvas.height / 2);
        context.restore();
    }
    
    //this.physicsMaterial.draw(context);
    
    //draw the court
    /*context.beginPath();
    context.moveTo(this.court[0][0], this.court[0][1]);
    for (var t = 0; t < this.court.length; t++) {
        context.lineTo(this.court[t][0], this.court[t][1]);
    }
    context.strokeStyle = this.paddleColor;
    context.stroke();
    context.closePath();*/
}

Player.prototype.computePhysicsMaterial = function () {
    var len = (this.paddleLength / this.sideLength) * (this.paddleDeltaRange[1] - this.paddleDeltaRange[0]);
    var height = this.paddleHeight;
    var relativeVertices = [];
    
    var startX = this.paddlePosition[0];
    var startY = this.paddlePosition[1];
    
    var x1 = -(this.paddleVector[0] * (this.paddleDeltaRange[0] + len)) * 0.5;
    var y1 = -(this.paddleVector[1] * (this.paddleDeltaRange[0] + len)) * 0.5;
    
    relativeVertices.push(new V(Math.floor(-x1), Math.floor(-y1)));
    relativeVertices.push(new V(Math.floor(x1), Math.floor(y1)));
    
    var v2 = [this.normal[0] * this.paddleHeight, this.normal[1] * this.paddleHeight];
    
    relativeVertices.push(new V(Math.floor(x1 + v2[0]), Math.floor(y1 + v2[1])));
    relativeVertices.push(new V(Math.floor(-x1 + v2[0]), Math.floor(-y1 + v2[1])));
    
    relativeVertices.reverse();
    
    this.physicsMaterial = new P(new V(Math.floor(startX), Math.floor(startY)), relativeVertices);
}

Player.prototype.lose = function (loseAll) {
    if (--this.livesLeft <= 0 || loseAll) {
        this.paddleColor = "black";
        this.paddleLength = this.sideLength;
        this.computePhysicsMaterial();
        this.movePaddle(0);
        this.type = "object";
        this.livesLeft = 0;
    }
}

Player.prototype.alignBoardToThisPlayer = function (canvas, context) {
    //find the rotation from the player's paddle vector to the bottom of the board space
    var angle = angleBetween(this.paddleVector, [1, 0]); //what do we rotate by to rotate the player side onto the x-axis
    console.log("angle: "+angle);
    angle = (angle - 180) * TO_RADIANS;
    //rotatedVector(v, angle, true);
    
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(angle);
    context.translate(-canvas.width / 2, -canvas.height / 2);
    
    return angle;
}

Player.prototype.transformTextPosition = function (canvas, angle, scale) { //angle in radians
    var ox = 500;//canvas.width / 2;
    var oy = 500;//canvas.height / 2;
    
    var xt = this.drawTextPosition[0] - ox;
    var yt = this.drawTextPosition[1] - oy;
    var xr, yr;
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    //rotate
    
    if (angle >= 0) {
        xr = (xt * cos) + (yt * sin);
        yr = -(xt * sin) + (yt * cos);
    } else {
        xr = (xt * cos) - (yt * sin);
        yr = (xt * sin) + (yt * cos);
    }
    
    this.drawTextPosition[0] = xr;
    this.drawTextPosition[1] = yr;
    //translate back
    this.drawTextPosition[0] = (this.drawTextPosition[0]);
    this.drawTextPosition[1] = (this.drawTextPosition[1]);
    
    this.textAlign = this.drawTextPosition[0] > 0 ? "left" : "right";
    if (Math.abs(this.drawTextPosition[0]) <= 2) {
        this.textAlign = "center";
    }
}

function computeBoard(numPlayers, sideLength, center) { //min 3, if  2 special case
    //work with degrees at first and then to radians at the end for increased accuracy
    
    var n = 0;
    var radius = sideLength / (2 * Math.sin(Math.PI / numPlayers));
    var border = [];
    
    for (var i = 0; i < numPlayers; i++) {
        var line = [];
        for (var j = 0; j < 2; j++) {
            var xn = radius * Math.cos(2*pi*n/ numPlayers) + center[0];
            var yn = radius * Math.sin(2*pi*n/ numPlayers) + center[1];
            line.push([xn,yn]);
            n += 1 - Math.ceil(j / 2);
        }
        
        border.push(line);
    }
    
    return border;
}

function weldBorder(border) {
    var polygon = [];
    
    for (var i = 0; i < border.length; i++) {
        polygon.push(border[i][0]);
    }
    polygon.push(border[i - 1][1]);
    
    return polygon;
}

function initPlayers(numPlayers, sideLength, paddleLength, border, playerIds, playerNames, special2, maxLives) {
    //TODO: implement ai designation
    //this allows us to supply maybe 2 playerIds and 7 numPlayers, and assume that 5 players are ai. From there we just need to evenly distribute the humans
    //AIs is an array of bools corresponding
    //if only 2 players, then the even players will be human, and the odd will be killed immediately, making their paddles fill their wall
    var id, name, players = [];
    var isWall = false;
    var AIs = [], a = 0, p = 0, interval = Math.floor((numPlayers - playerIds.length) / playerIds.length);
    
    if (special2) {
        if (playerIds.length === 1) {
            AIs = [false, true, true, true];
        }
    } else {
        //7 and 2: [0,1,1,0,1,1,1]
        //3 and 1: 3-1 = 2/1 = 2 -> [0,1,1]
        //3 and 2: 3-1 = 1/2 = 0 -> [0,0,1]
        for (var i = 0; i < playerIds.length; i++) {
            AIs.push(false); //add a human
            for (var t = 0; t < interval; t++) { //add ais in between humans
                AIs.push(true);
            }
        }
        //fill in any gap
        while (AIs.length < numPlayers) {
            AIs.push(true);
        }
    }
    console.log("AIs: "+AIs);
    
    for (var n = 0; n < numPlayers; n++) {
        var paddleVector = subtract(border[n][1], border[n][0]);
        var paddleVectorStart = border[n][0];
        var paddleDeltaRange = [0, 1];
        var paddleDelta = 0.5;
        var paddlePosition = [0, 0];
        if (special2) {
            if (n % 2 === 0) {
                if (AIs[n]) {
                    name = "AI: "+a;
                    a++;
                    id = -n;
                } else {
                    id = playerIds[p];
                    name = playerNames[p];
                    p++;
                }
                isWall = false;
            } else {
                id = n;
                name = "name"+n;
                isWall = true;
            }
        } else {
            if (AIs[n]) {
                name = "AI: "+a;
                a++;
                id = -n;
            } else {
                id = playerIds[p];
                name = playerNames[p];
                p++;
            }
        }
        console.log(id);
        var player = new Player(id, name, paddleVector, paddleVectorStart, paddleDeltaRange, paddleDelta, paddlePosition, "red", paddleLength, sideLength, isWall, AIs[n] && !isWall, maxLives);
        if (isWall) {
            player.lose(true);
        }
        
        players.push(player);
    }
    
    return players;
}

function generateBall(center, radius, speed, server) {
    var theta = Math.round(Math.random() * 360) * TO_RADIANS;
    var x = speed * Math.cos(theta);
    var y = speed * Math.sin(theta);
    return new Ball(radius, [center[0], center[1]], [x, y], "black", server);
}

function initBalls(numBalls, center, radius, speed, server) {
    var balls = [];
    
    while (numBalls-- > 0) {
        balls.push(generateBall(center, radius, speed, server));
    }
    
    return balls;
}

window.createGame = function (canvas, numPlayers, sideLength, server, playerIds, playerNames, gametype, maxPoints, maxLives, numBalls) {
    console.log("numPlayers: "+numPlayers);
    //the origin must be static, but the drawing method may change
    var special2 = false;
    if (gametype !== "points") {
        maxPoints = 0;
    }
    if (gametype !== "elimination") {
        maxLives = 0;
    }
    if (numPlayers < 2) {
        console.error("Unsupported");
        return;
    }
    if (numPlayers === 2) {
        special2 = true;
        numPlayers = 4;
    }
    console.log("isSpecial: "+special2);
    console.log("playerIds: "+playerIds);
    
    var balls = initBalls(numBalls, [500, 500], 10, 200, server);
    var border = computeBoard(numPlayers, sideLength, [500, 500]);
    var players = initPlayers(numPlayers, sideLength, 0.25 * sideLength, border, playerIds, playerNames, special2, maxLives);
    var polygon = weldBorder(border);
    if (!server) {
        canvas.width = 1000;
        canvas.height = 1000;
    }
    return new Board(gametype, maxPoints, balls, polygon, players);
}

////////////////////////Point in polygon. Credit to Paul Borke at dartmouth.edu

function min(x, y) {
    return x < y ? x : y;
}

function max(x, y) {
    return x > y ? x : y;
}

function insidePolygon(polygon, p) {
    var counter = 0;
    var xinters;
    var p1, p2;

    p1 = polygon[0];
    for (var i = 1; i <= polygon.length; i++) {
        p2 = polygon[i % polygon.length];
        
        if (p[1] > min(p1[1], p2[1])) {
            if (p[1] <= max(p1[1], p2[1])) {
                if (p[0] <= max(p1[0], p2[0])) {
                    if (p1[1] != p2[1]) {
                        xinters = (p[1] - p1[1]) * (p2[0] - p1[0]) / (p2[1] - p1[1]) + p1[0];
                        
                        if (p1[0] === p2[0] || p[0] <= xinters) {
                            counter++;
                        }
                    }
                }
            }
        }
        p1 = p2;
    }

    return (counter % 2 !== 0);
}

module.exports = {
    createGame: window.createGame
};
