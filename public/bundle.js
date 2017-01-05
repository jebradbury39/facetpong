(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Version 0.5.0 - Copyright 2012 - 2015 -  Jim Riecken <jimr@jimr.ca>
//
// Released under the MIT License - https://github.com/jriecken/sat-js
//
// A simple library for determining intersections of circles and
// polygons using the Separating Axis Theorem.
/** @preserve SAT.js - Version 0.5.0 - Copyright 2012 - 2015 - Jim Riecken <jimr@jimr.ca> - released under the MIT License. https://github.com/jriecken/sat-js */

/*global define: false, module: false*/
/*jshint shadow:true, sub:true, forin:true, noarg:true, noempty:true, 
  eqeqeq:true, bitwise:true, strict:true, undef:true, 
  curly:true, browser:true */

// Create a UMD wrapper for SAT. Works in:
//
//  - Plain browser via global SAT variable
//  - AMD loader (like require.js)
//  - Node.js
//
// The quoted properties all over the place are used so that the Closure Compiler
// does not mangle the exposed API in advanced mode.
/**
 * @param {*} root - The global scope
 * @param {Function} factory - Factory that creates SAT module
 */
(function (root, factory) {
  "use strict";
  if (typeof define === 'function' && define['amd']) {
    define(factory);
  } else if (typeof exports === 'object') {
    module['exports'] = factory();
  } else {
    root['SAT'] = factory();
  }
}(this, function () {
  "use strict";

  var SAT = {};

  //
  // ## Vector
  //
  // Represents a vector in two dimensions with `x` and `y` properties.


  // Create a new Vector, optionally passing in the `x` and `y` coordinates. If
  // a coordinate is not specified, it will be set to `0`
  /** 
   * @param {?number=} x The x position.
   * @param {?number=} y The y position.
   * @constructor
   */
  function Vector(x, y) {
    this['x'] = x || 0;
    this['y'] = y || 0;
  }
  SAT['Vector'] = Vector;
  // Alias `Vector` as `V`
  SAT['V'] = Vector;


  // Copy the values of another Vector into this one.
  /**
   * @param {Vector} other The other Vector.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['copy'] = Vector.prototype.copy = function(other) {
    this['x'] = other['x'];
    this['y'] = other['y'];
    return this;
  };

  // Create a new vector with the same coordinates as this on.
  /**
   * @return {Vector} The new cloned vector
   */
  Vector.prototype['clone'] = Vector.prototype.clone = function() {
    return new Vector(this['x'], this['y']);
  };

  // Change this vector to be perpendicular to what it was before. (Effectively
  // roatates it 90 degrees in a clockwise direction)
  /**
   * @return {Vector} This for chaining.
   */
  Vector.prototype['perp'] = Vector.prototype.perp = function() {
    var x = this['x'];
    this['x'] = this['y'];
    this['y'] = -x;
    return this;
  };

  // Rotate this vector (counter-clockwise) by the specified angle (in radians).
  /**
   * @param {number} angle The angle to rotate (in radians)
   * @return {Vector} This for chaining.
   */
  Vector.prototype['rotate'] = Vector.prototype.rotate = function (angle) {
    var x = this['x'];
    var y = this['y'];
    this['x'] = x * Math.cos(angle) - y * Math.sin(angle);
    this['y'] = x * Math.sin(angle) + y * Math.cos(angle);
    return this;
  };

  // Reverse this vector.
  /**
   * @return {Vector} This for chaining.
   */
  Vector.prototype['reverse'] = Vector.prototype.reverse = function() {
    this['x'] = -this['x'];
    this['y'] = -this['y'];
    return this;
  };
  

  // Normalize this vector.  (make it have length of `1`)
  /**
   * @return {Vector} This for chaining.
   */
  Vector.prototype['normalize'] = Vector.prototype.normalize = function() {
    var d = this.len();
    if(d > 0) {
      this['x'] = this['x'] / d;
      this['y'] = this['y'] / d;
    }
    return this;
  };
  
  // Add another vector to this one.
  /**
   * @param {Vector} other The other Vector.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['add'] = Vector.prototype.add = function(other) {
    this['x'] += other['x'];
    this['y'] += other['y'];
    return this;
  };
  
  // Subtract another vector from this one.
  /**
   * @param {Vector} other The other Vector.
   * @return {Vector} This for chaiing.
   */
  Vector.prototype['sub'] = Vector.prototype.sub = function(other) {
    this['x'] -= other['x'];
    this['y'] -= other['y'];
    return this;
  };
  
  // Scale this vector. An independant scaling factor can be provided
  // for each axis, or a single scaling factor that will scale both `x` and `y`.
  /**
   * @param {number} x The scaling factor in the x direction.
   * @param {?number=} y The scaling factor in the y direction.  If this
   *   is not specified, the x scaling factor will be used.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['scale'] = Vector.prototype.scale = function(x,y) {
    this['x'] *= x;
    this['y'] *= y || x;
    return this; 
  };
  
  // Project this vector on to another vector.
  /**
   * @param {Vector} other The vector to project onto.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['project'] = Vector.prototype.project = function(other) {
    var amt = this.dot(other) / other.len2();
    this['x'] = amt * other['x'];
    this['y'] = amt * other['y'];
    return this;
  };
  
  // Project this vector onto a vector of unit length. This is slightly more efficient
  // than `project` when dealing with unit vectors.
  /**
   * @param {Vector} other The unit vector to project onto.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['projectN'] = Vector.prototype.projectN = function(other) {
    var amt = this.dot(other);
    this['x'] = amt * other['x'];
    this['y'] = amt * other['y'];
    return this;
  };
  
  // Reflect this vector on an arbitrary axis.
  /**
   * @param {Vector} axis The vector representing the axis.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['reflect'] = Vector.prototype.reflect = function(axis) {
    var x = this['x'];
    var y = this['y'];
    this.project(axis).scale(2);
    this['x'] -= x;
    this['y'] -= y;
    return this;
  };
  
  // Reflect this vector on an arbitrary axis (represented by a unit vector). This is
  // slightly more efficient than `reflect` when dealing with an axis that is a unit vector.
  /**
   * @param {Vector} axis The unit vector representing the axis.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['reflectN'] = Vector.prototype.reflectN = function(axis) {
    var x = this['x'];
    var y = this['y'];
    this.projectN(axis).scale(2);
    this['x'] -= x;
    this['y'] -= y;
    return this;
  };
  
  // Get the dot product of this vector and another.
  /**
   * @param {Vector}  other The vector to dot this one against.
   * @return {number} The dot product.
   */
  Vector.prototype['dot'] = Vector.prototype.dot = function(other) {
    return this['x'] * other['x'] + this['y'] * other['y'];
  };
  
  // Get the squared length of this vector.
  /**
   * @return {number} The length^2 of this vector.
   */
  Vector.prototype['len2'] = Vector.prototype.len2 = function() {
    return this.dot(this);
  };
  
  // Get the length of this vector.
  /**
   * @return {number} The length of this vector.
   */
  Vector.prototype['len'] = Vector.prototype.len = function() {
    return Math.sqrt(this.len2());
  };
  
  // ## Circle
  //
  // Represents a circle with a position and a radius.

  // Create a new circle, optionally passing in a position and/or radius. If no position
  // is given, the circle will be at `(0,0)`. If no radius is provided, the circle will
  // have a radius of `0`.
  /**
   * @param {Vector=} pos A vector representing the position of the center of the circle
   * @param {?number=} r The radius of the circle
   * @constructor
   */
  function Circle(pos, r) {
    this['pos'] = pos || new Vector();
    this['r'] = r || 0;
  }
  SAT['Circle'] = Circle;
  
  // Compute the axis-aligned bounding box (AABB) of this Circle.
  //
  // Note: Returns a _new_ `Polygon` each time you call this.
  /**
   * @return {Polygon} The AABB
   */
  Circle.prototype['getAABB'] = Circle.prototype.getAABB = function() {
    var r = this['r'];
    var corner = this["pos"].clone().sub(new Vector(r, r));
    return new Box(corner, r*2, r*2).toPolygon();
  };

  // ## Polygon
  //
  // Represents a *convex* polygon with any number of points (specified in counter-clockwise order)
  //
  // Note: Do _not_ manually change the `points`, `angle`, or `offset` properties. Use the
  // provided setters. Otherwise the calculated properties will not be updated correctly.
  //
  // `pos` can be changed directly.

  // Create a new polygon, passing in a position vector, and an array of points (represented
  // by vectors relative to the position vector). If no position is passed in, the position
  // of the polygon will be `(0,0)`.
  /**
   * @param {Vector=} pos A vector representing the origin of the polygon. (all other
   *   points are relative to this one)
   * @param {Array.<Vector>=} points An array of vectors representing the points in the polygon,
   *   in counter-clockwise order.
   * @constructor
   */
  function Polygon(pos, points) {
    this['pos'] = pos || new Vector();
    this['angle'] = 0;
    this['offset'] = new Vector();
    this.setPoints(points || []);
  }
  SAT['Polygon'] = Polygon;
  
  // Set the points of the polygon.
  /**
   * @param {Array.<Vector>=} points An array of vectors representing the points in the polygon,
   *   in counter-clockwise order.
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['setPoints'] = Polygon.prototype.setPoints = function(points) {
    // Only re-allocate if this is a new polygon or the number of points has changed.
    var lengthChanged = !this['points'] || this['points'].length !== points.length;
    if (lengthChanged) {
      var i;
      var calcPoints = this['calcPoints'] = [];
      var edges = this['edges'] = [];
      var normals = this['normals'] = [];
      // Allocate the vector arrays for the calculated properties
      for (i = 0; i < points.length; i++) {
        calcPoints.push(new Vector());
        edges.push(new Vector());
        normals.push(new Vector());
      }
    }
    this['points'] = points;
    this._recalc();
    return this;
  };

  // Set the current rotation angle of the polygon.
  /**
   * @param {number} angle The current rotation angle (in radians).
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['setAngle'] = Polygon.prototype.setAngle = function(angle) {
    this['angle'] = angle;
    this._recalc();
    return this;
  };

  // Set the current offset to apply to the `points` before applying the `angle` rotation.
  /**
   * @param {Vector} offset The new offset vector.
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['setOffset'] = Polygon.prototype.setOffset = function(offset) {
    this['offset'] = offset;
    this._recalc();
    return this;
  };

  // Rotates this polygon counter-clockwise around the origin of *its local coordinate system* (i.e. `pos`).
  //
  // Note: This changes the **original** points (so any `angle` will be applied on top of this rotation).
  /**
   * @param {number} angle The angle to rotate (in radians)
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['rotate'] = Polygon.prototype.rotate = function(angle) {
    var points = this['points'];
    var len = points.length;
    for (var i = 0; i < len; i++) {
      points[i].rotate(angle);
    }
    this._recalc();
    return this;
  };

  // Translates the points of this polygon by a specified amount relative to the origin of *its own coordinate
  // system* (i.e. `pos`).
  //
  // This is most useful to change the "center point" of a polygon. If you just want to move the whole polygon, change
  // the coordinates of `pos`.
  //
  // Note: This changes the **original** points (so any `offset` will be applied on top of this translation)
  /**
   * @param {number} x The horizontal amount to translate.
   * @param {number} y The vertical amount to translate.
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['translate'] = Polygon.prototype.translate = function (x, y) {
    var points = this['points'];
    var len = points.length;
    for (var i = 0; i < len; i++) {
      points[i].x += x;
      points[i].y += y;
    }
    this._recalc();
    return this;
  };


  // Computes the calculated collision polygon. Applies the `angle` and `offset` to the original points then recalculates the
  // edges and normals of the collision polygon.
  /**
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype._recalc = function() {
    // Calculated points - this is what is used for underlying collisions and takes into account
    // the angle/offset set on the polygon.
    var calcPoints = this['calcPoints'];
    // The edges here are the direction of the `n`th edge of the polygon, relative to
    // the `n`th point. If you want to draw a given edge from the edge value, you must
    // first translate to the position of the starting point.
    var edges = this['edges'];
    // The normals here are the direction of the normal for the `n`th edge of the polygon, relative
    // to the position of the `n`th point. If you want to draw an edge normal, you must first
    // translate to the position of the starting point.
    var normals = this['normals'];
    // Copy the original points array and apply the offset/angle
    var points = this['points'];
    var offset = this['offset'];
    var angle = this['angle'];
    var len = points.length;
    var i;
    for (i = 0; i < len; i++) {
      var calcPoint = calcPoints[i].copy(points[i]);
      calcPoint.x += offset.x;
      calcPoint.y += offset.y;
      if (angle !== 0) {
        calcPoint.rotate(angle);
      }
    }
    // Calculate the edges/normals
    for (i = 0; i < len; i++) {
      var p1 = calcPoints[i];
      var p2 = i < len - 1 ? calcPoints[i + 1] : calcPoints[0];
      var e = edges[i].copy(p2).sub(p1);
      normals[i].copy(e).perp().normalize();
    }
    return this;
  };
  
  
  // Compute the axis-aligned bounding box. Any current state
  // (translations/rotations) will be applied before constructing the AABB.
  //
  // Note: Returns a _new_ `Polygon` each time you call this.
  /**
   * @return {Polygon} The AABB
   */
  Polygon.prototype["getAABB"] = Polygon.prototype.getAABB = function() {
    var points = this["calcPoints"];
    var len = points.length;
    var xMin = points[0]["x"];
    var yMin = points[0]["y"];
    var xMax = points[0]["x"];
    var yMax = points[0]["y"];
    for (var i = 1; i < len; i++) {
      var point = points[i];
      if (point["x"] < xMin) {
        xMin = point["x"];
      }
      else if (point["x"] > xMax) {
        xMax = point["x"];
      }
      if (point["y"] < yMin) {
        yMin = point["y"];
      }
      else if (point["y"] > yMax) {
        yMax = point["y"];
      }
    }
    return new Box(this["pos"].clone().add(new Vector(xMin, yMin)), xMax - xMin, yMax - yMin).toPolygon();
  };
  

  // ## Box
  //
  // Represents an axis-aligned box, with a width and height.


  // Create a new box, with the specified position, width, and height. If no position
  // is given, the position will be `(0,0)`. If no width or height are given, they will
  // be set to `0`.
  /**
   * @param {Vector=} pos A vector representing the top-left of the box.
   * @param {?number=} w The width of the box.
   * @param {?number=} h The height of the box.
   * @constructor
   */
  function Box(pos, w, h) {
    this['pos'] = pos || new Vector();
    this['w'] = w || 0;
    this['h'] = h || 0;
  }
  SAT['Box'] = Box;

  // Returns a polygon whose edges are the same as this box.
  /**
   * @return {Polygon} A new Polygon that represents this box.
   */
  Box.prototype['toPolygon'] = Box.prototype.toPolygon = function() {
    var pos = this['pos'];
    var w = this['w'];
    var h = this['h'];
    return new Polygon(new Vector(pos['x'], pos['y']), [
     new Vector(), new Vector(w, 0), 
     new Vector(w,h), new Vector(0,h)
    ]);
  };
  
  // ## Response
  //
  // An object representing the result of an intersection. Contains:
  //  - The two objects participating in the intersection
  //  - The vector representing the minimum change necessary to extract the first object
  //    from the second one (as well as a unit vector in that direction and the magnitude
  //    of the overlap)
  //  - Whether the first object is entirely inside the second, and vice versa.
  /**
   * @constructor
   */  
  function Response() {
    this['a'] = null;
    this['b'] = null;
    this['overlapN'] = new Vector();
    this['overlapV'] = new Vector();
    this.clear();
  }
  SAT['Response'] = Response;

  // Set some values of the response back to their defaults.  Call this between tests if
  // you are going to reuse a single Response object for multiple intersection tests (recommented
  // as it will avoid allcating extra memory)
  /**
   * @return {Response} This for chaining
   */
  Response.prototype['clear'] = Response.prototype.clear = function() {
    this['aInB'] = true;
    this['bInA'] = true;
    this['overlap'] = Number.MAX_VALUE;
    return this;
  };

  // ## Object Pools

  // A pool of `Vector` objects that are used in calculations to avoid
  // allocating memory.
  /**
   * @type {Array.<Vector>}
   */
  var T_VECTORS = [];
  for (var i = 0; i < 10; i++) { T_VECTORS.push(new Vector()); }
  
  // A pool of arrays of numbers used in calculations to avoid allocating
  // memory.
  /**
   * @type {Array.<Array.<number>>}
   */
  var T_ARRAYS = [];
  for (var i = 0; i < 5; i++) { T_ARRAYS.push([]); }

  // Temporary response used for polygon hit detection.
  /**
   * @type {Response}
   */
  var T_RESPONSE = new Response();

  // Unit square polygon used for polygon hit detection.
  /**
   * @type {Polygon}
   */
  var UNIT_SQUARE = new Box(new Vector(), 1, 1).toPolygon();

  // ## Helper Functions

  // Flattens the specified array of points onto a unit vector axis,
  // resulting in a one dimensional range of the minimum and
  // maximum value on that axis.
  /**
   * @param {Array.<Vector>} points The points to flatten.
   * @param {Vector} normal The unit vector axis to flatten on.
   * @param {Array.<number>} result An array.  After calling this function,
   *   result[0] will be the minimum value,
   *   result[1] will be the maximum value.
   */
  function flattenPointsOn(points, normal, result) {
    var min = Number.MAX_VALUE;
    var max = -Number.MAX_VALUE;
    var len = points.length;
    for (var i = 0; i < len; i++ ) {
      // The magnitude of the projection of the point onto the normal
      var dot = points[i].dot(normal);
      if (dot < min) { min = dot; }
      if (dot > max) { max = dot; }
    }
    result[0] = min; result[1] = max;
  }
  
  // Check whether two convex polygons are separated by the specified
  // axis (must be a unit vector).
  /**
   * @param {Vector} aPos The position of the first polygon.
   * @param {Vector} bPos The position of the second polygon.
   * @param {Array.<Vector>} aPoints The points in the first polygon.
   * @param {Array.<Vector>} bPoints The points in the second polygon.
   * @param {Vector} axis The axis (unit sized) to test against.  The points of both polygons
   *   will be projected onto this axis.
   * @param {Response=} response A Response object (optional) which will be populated
   *   if the axis is not a separating axis.
   * @return {boolean} true if it is a separating axis, false otherwise.  If false,
   *   and a response is passed in, information about how much overlap and
   *   the direction of the overlap will be populated.
   */
  function isSeparatingAxis(aPos, bPos, aPoints, bPoints, axis, response) {
    var rangeA = T_ARRAYS.pop();
    var rangeB = T_ARRAYS.pop();
    // The magnitude of the offset between the two polygons
    var offsetV = T_VECTORS.pop().copy(bPos).sub(aPos);
    var projectedOffset = offsetV.dot(axis);
    // Project the polygons onto the axis.
    flattenPointsOn(aPoints, axis, rangeA);
    flattenPointsOn(bPoints, axis, rangeB);
    // Move B's range to its position relative to A.
    rangeB[0] += projectedOffset;
    rangeB[1] += projectedOffset;
    // Check if there is a gap. If there is, this is a separating axis and we can stop
    if (rangeA[0] > rangeB[1] || rangeB[0] > rangeA[1]) {
      T_VECTORS.push(offsetV); 
      T_ARRAYS.push(rangeA); 
      T_ARRAYS.push(rangeB);
      return true;
    }
    // This is not a separating axis. If we're calculating a response, calculate the overlap.
    if (response) {
      var overlap = 0;
      // A starts further left than B
      if (rangeA[0] < rangeB[0]) {
        response['aInB'] = false;
        // A ends before B does. We have to pull A out of B
        if (rangeA[1] < rangeB[1]) { 
          overlap = rangeA[1] - rangeB[0];
          response['bInA'] = false;
        // B is fully inside A.  Pick the shortest way out.
        } else {
          var option1 = rangeA[1] - rangeB[0];
          var option2 = rangeB[1] - rangeA[0];
          overlap = option1 < option2 ? option1 : -option2;
        }
      // B starts further left than A
      } else {
        response['bInA'] = false;
        // B ends before A ends. We have to push A out of B
        if (rangeA[1] > rangeB[1]) { 
          overlap = rangeA[0] - rangeB[1];
          response['aInB'] = false;
        // A is fully inside B.  Pick the shortest way out.
        } else {
          var option1 = rangeA[1] - rangeB[0];
          var option2 = rangeB[1] - rangeA[0];
          overlap = option1 < option2 ? option1 : -option2;
        }
      }
      // If this is the smallest amount of overlap we've seen so far, set it as the minimum overlap.
      var absOverlap = Math.abs(overlap);
      if (absOverlap < response['overlap']) {
        response['overlap'] = absOverlap;
        response['overlapN'].copy(axis);
        if (overlap < 0) {
          response['overlapN'].reverse();
        }
      }      
    }
    T_VECTORS.push(offsetV); 
    T_ARRAYS.push(rangeA); 
    T_ARRAYS.push(rangeB);
    return false;
  }
  
  // Calculates which Vornoi region a point is on a line segment.
  // It is assumed that both the line and the point are relative to `(0,0)`
  //
  //            |       (0)      |
  //     (-1)  [S]--------------[E]  (1)
  //            |       (0)      |
  /**
   * @param {Vector} line The line segment.
   * @param {Vector} point The point.
   * @return  {number} LEFT_VORNOI_REGION (-1) if it is the left region, 
   *          MIDDLE_VORNOI_REGION (0) if it is the middle region, 
   *          RIGHT_VORNOI_REGION (1) if it is the right region.
   */
  function vornoiRegion(line, point) {
    var len2 = line.len2();
    var dp = point.dot(line);
    // If the point is beyond the start of the line, it is in the
    // left vornoi region.
    if (dp < 0) { return LEFT_VORNOI_REGION; }
    // If the point is beyond the end of the line, it is in the
    // right vornoi region.
    else if (dp > len2) { return RIGHT_VORNOI_REGION; }
    // Otherwise, it's in the middle one.
    else { return MIDDLE_VORNOI_REGION; }
  }
  // Constants for Vornoi regions
  /**
   * @const
   */
  var LEFT_VORNOI_REGION = -1;
  /**
   * @const
   */
  var MIDDLE_VORNOI_REGION = 0;
  /**
   * @const
   */
  var RIGHT_VORNOI_REGION = 1;
  
  // ## Collision Tests

  // Check if a point is inside a circle.
  /**
   * @param {Vector} p The point to test.
   * @param {Circle} c The circle to test.
   * @return {boolean} true if the point is inside the circle, false if it is not.
   */
  function pointInCircle(p, c) {
    var differenceV = T_VECTORS.pop().copy(p).sub(c['pos']);
    var radiusSq = c['r'] * c['r'];
    var distanceSq = differenceV.len2();
    T_VECTORS.push(differenceV);
    // If the distance between is smaller than the radius then the point is inside the circle.
    return distanceSq <= radiusSq;
  }
  SAT['pointInCircle'] = pointInCircle;

  // Check if a point is inside a convex polygon.
  /**
   * @param {Vector} p The point to test.
   * @param {Polygon} poly The polygon to test.
   * @return {boolean} true if the point is inside the polygon, false if it is not.
   */
  function pointInPolygon(p, poly) {
    UNIT_SQUARE['pos'].copy(p);
    T_RESPONSE.clear();
    var result = testPolygonPolygon(UNIT_SQUARE, poly, T_RESPONSE);
    if (result) {
      result = T_RESPONSE['aInB'];
    }
    return result;
  }
  SAT['pointInPolygon'] = pointInPolygon;

  // Check if two circles collide.
  /**
   * @param {Circle} a The first circle.
   * @param {Circle} b The second circle.
   * @param {Response=} response Response object (optional) that will be populated if
   *   the circles intersect.
   * @return {boolean} true if the circles intersect, false if they don't. 
   */
  function testCircleCircle(a, b, response) {
    // Check if the distance between the centers of the two
    // circles is greater than their combined radius.
    var differenceV = T_VECTORS.pop().copy(b['pos']).sub(a['pos']);
    var totalRadius = a['r'] + b['r'];
    var totalRadiusSq = totalRadius * totalRadius;
    var distanceSq = differenceV.len2();
    // If the distance is bigger than the combined radius, they don't intersect.
    if (distanceSq > totalRadiusSq) {
      T_VECTORS.push(differenceV);
      return false;
    }
    // They intersect.  If we're calculating a response, calculate the overlap.
    if (response) { 
      var dist = Math.sqrt(distanceSq);
      response['a'] = a;
      response['b'] = b;
      response['overlap'] = totalRadius - dist;
      response['overlapN'].copy(differenceV.normalize());
      response['overlapV'].copy(differenceV).scale(response['overlap']);
      response['aInB']= a['r'] <= b['r'] && dist <= b['r'] - a['r'];
      response['bInA'] = b['r'] <= a['r'] && dist <= a['r'] - b['r'];
    }
    T_VECTORS.push(differenceV);
    return true;
  }
  SAT['testCircleCircle'] = testCircleCircle;
  
  // Check if a polygon and a circle collide.
  /**
   * @param {Polygon} polygon The polygon.
   * @param {Circle} circle The circle.
   * @param {Response=} response Response object (optional) that will be populated if
   *   they interset.
   * @return {boolean} true if they intersect, false if they don't.
   */
  function testPolygonCircle(polygon, circle, response) {
    // Get the position of the circle relative to the polygon.
    var circlePos = T_VECTORS.pop().copy(circle['pos']).sub(polygon['pos']);
    var radius = circle['r'];
    var radius2 = radius * radius;
    var points = polygon['calcPoints'];
    var len = points.length;
    var edge = T_VECTORS.pop();
    var point = T_VECTORS.pop();
    
    // For each edge in the polygon:
    for (var i = 0; i < len; i++) {
      var next = i === len - 1 ? 0 : i + 1;
      var prev = i === 0 ? len - 1 : i - 1;
      var overlap = 0;
      var overlapN = null;
      
      // Get the edge.
      edge.copy(polygon['edges'][i]);
      // Calculate the center of the circle relative to the starting point of the edge.
      point.copy(circlePos).sub(points[i]);
      
      // If the distance between the center of the circle and the point
      // is bigger than the radius, the polygon is definitely not fully in
      // the circle.
      if (response && point.len2() > radius2) {
        response['aInB'] = false;
      }
      
      // Calculate which Vornoi region the center of the circle is in.
      var region = vornoiRegion(edge, point);
      // If it's the left region:
      if (region === LEFT_VORNOI_REGION) { 
        // We need to make sure we're in the RIGHT_VORNOI_REGION of the previous edge.
        edge.copy(polygon['edges'][prev]);
        // Calculate the center of the circle relative the starting point of the previous edge
        var point2 = T_VECTORS.pop().copy(circlePos).sub(points[prev]);
        region = vornoiRegion(edge, point2);
        if (region === RIGHT_VORNOI_REGION) {
          // It's in the region we want.  Check if the circle intersects the point.
          var dist = point.len();
          if (dist > radius) {
            // No intersection
            T_VECTORS.push(circlePos); 
            T_VECTORS.push(edge);
            T_VECTORS.push(point); 
            T_VECTORS.push(point2);
            return false;
          } else if (response) {
            // It intersects, calculate the overlap.
            response['bInA'] = false;
            overlapN = point.normalize();
            overlap = radius - dist;
          }
        }
        T_VECTORS.push(point2);
      // If it's the right region:
      } else if (region === RIGHT_VORNOI_REGION) {
        // We need to make sure we're in the left region on the next edge
        edge.copy(polygon['edges'][next]);
        // Calculate the center of the circle relative to the starting point of the next edge.
        point.copy(circlePos).sub(points[next]);
        region = vornoiRegion(edge, point);
        if (region === LEFT_VORNOI_REGION) {
          // It's in the region we want.  Check if the circle intersects the point.
          var dist = point.len();
          if (dist > radius) {
            // No intersection
            T_VECTORS.push(circlePos); 
            T_VECTORS.push(edge); 
            T_VECTORS.push(point);
            return false;              
          } else if (response) {
            // It intersects, calculate the overlap.
            response['bInA'] = false;
            overlapN = point.normalize();
            overlap = radius - dist;
          }
        }
      // Otherwise, it's the middle region:
      } else {
        // Need to check if the circle is intersecting the edge,
        // Change the edge into its "edge normal".
        var normal = edge.perp().normalize();
        // Find the perpendicular distance between the center of the 
        // circle and the edge.
        var dist = point.dot(normal);
        var distAbs = Math.abs(dist);
        // If the circle is on the outside of the edge, there is no intersection.
        if (dist > 0 && distAbs > radius) {
          // No intersection
          T_VECTORS.push(circlePos); 
          T_VECTORS.push(normal); 
          T_VECTORS.push(point);
          return false;
        } else if (response) {
          // It intersects, calculate the overlap.
          overlapN = normal;
          overlap = radius - dist;
          // If the center of the circle is on the outside of the edge, or part of the
          // circle is on the outside, the circle is not fully inside the polygon.
          if (dist >= 0 || overlap < 2 * radius) {
            response['bInA'] = false;
          }
        }
      }
      
      // If this is the smallest overlap we've seen, keep it. 
      // (overlapN may be null if the circle was in the wrong Vornoi region).
      if (overlapN && response && Math.abs(overlap) < Math.abs(response['overlap'])) {
        response['overlap'] = overlap;
        response['overlapN'].copy(overlapN);
      }
    }
    
    // Calculate the final overlap vector - based on the smallest overlap.
    if (response) {
      response['a'] = polygon;
      response['b'] = circle;
      response['overlapV'].copy(response['overlapN']).scale(response['overlap']);
    }
    T_VECTORS.push(circlePos); 
    T_VECTORS.push(edge); 
    T_VECTORS.push(point);
    return true;
  }
  SAT['testPolygonCircle'] = testPolygonCircle;
  
  // Check if a circle and a polygon collide.
  //
  // **NOTE:** This is slightly less efficient than polygonCircle as it just
  // runs polygonCircle and reverses everything at the end.
  /**
   * @param {Circle} circle The circle.
   * @param {Polygon} polygon The polygon.
   * @param {Response=} response Response object (optional) that will be populated if
   *   they interset.
   * @return {boolean} true if they intersect, false if they don't.
   */
  function testCirclePolygon(circle, polygon, response) {
    // Test the polygon against the circle.
    var result = testPolygonCircle(polygon, circle, response);
    if (result && response) {
      // Swap A and B in the response.
      var a = response['a'];
      var aInB = response['aInB'];
      response['overlapN'].reverse();
      response['overlapV'].reverse();
      response['a'] = response['b'];
      response['b'] = a;
      response['aInB'] = response['bInA'];
      response['bInA'] = aInB;
    }
    return result;
  }
  SAT['testCirclePolygon'] = testCirclePolygon;
  
  // Checks whether polygons collide.
  /**
   * @param {Polygon} a The first polygon.
   * @param {Polygon} b The second polygon.
   * @param {Response=} response Response object (optional) that will be populated if
   *   they interset.
   * @return {boolean} true if they intersect, false if they don't.
   */
  function testPolygonPolygon(a, b, response) {
    var aPoints = a['calcPoints'];
    var aLen = aPoints.length;
    var bPoints = b['calcPoints'];
    var bLen = bPoints.length;
    // If any of the edge normals of A is a separating axis, no intersection.
    for (var i = 0; i < aLen; i++) {
      if (isSeparatingAxis(a['pos'], b['pos'], aPoints, bPoints, a['normals'][i], response)) {
        return false;
      }
    }
    // If any of the edge normals of B is a separating axis, no intersection.
    for (var i = 0;i < bLen; i++) {
      if (isSeparatingAxis(a['pos'], b['pos'], aPoints, bPoints, b['normals'][i], response)) {
        return false;
      }
    }
    // Since none of the edge normals of A or B are a separating axis, there is an intersection
    // and we've already calculated the smallest overlap (in isSeparatingAxis).  Calculate the
    // final overlap vector.
    if (response) {
      response['a'] = a;
      response['b'] = b;
      response['overlapV'].copy(response['overlapN']).scale(response['overlap']);
    }
    return true;
  }
  SAT['testPolygonPolygon'] = testPolygonPolygon;

  return SAT;
}));

},{}],2:[function(require,module,exports){
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

},{"sat":1}]},{},[2]);
