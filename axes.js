'use strict'

module.exports = createAxes

var createText        = require('./lib/text.js')
var createLines       = require('./lib/lines.js')
var createBackground  = require('./lib/background.js')
var getCubeProperties = require('./lib/cube.js')
var Ticks             = require('./lib/ticks.js')

var identity = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1])

function copyVec3(a, b) {
  a[0] = b[0]
  a[1] = b[1]
  a[2] = b[2]
  return a
}

function Axes(gl) {
  this.gl             = gl

  this.pixelRatio     = 1

  this.bounds         = [ [-10, -10, -10], 
                          [ 10,  10,  10] ]
  this.ticks          = [ [], [], [] ]
  this.autoTicks      = true
  this.tickSpacing    = [ 1, 1, 1 ]

  this.tickEnable     = [ true, true, true ]
  this.tickFont       = [ 'sans-serif', 'sans-serif', 'sans-serif' ]
  this.tickSize       = [ 12, 12, 12 ]
  this.tickAngle      = [ 0, 0, 0 ]
  this.tickColor      = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]
  this.tickPad        = [ 0.05, 0.05, 0.05 ]

  this.lastCubeProps  = {
    cubeEdges: [0,0,0],
    axis:      [0,0,0]
  }

  this.labels         = [ 'x', 'y', 'z' ]
  this.labelEnable    = [ true, true, true ]
  this.labelFont      = 'sans-serif'
  this.labelSize      = [ 20, 20, 20 ]
  this.labelAngle     = [ 0, 0, 0 ]
  this.labelColor     = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]
  this.labelPad       = [ 0.05, 0.05, 0.05 ]

  this.lineEnable     = [ true, true, true ]
  this.lineMirror     = [ false, false, false ]
  this.lineWidth      = [ 1, 1, 1 ]
  this.lineColor      = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]

  this.lineTickEnable = [ true, true, true ]
  this.lineTickMirror = [ false, false, false ]
  this.lineTickLength = [ 0, 0, 0 ]
  this.lineTickWidth  = [ 1, 1, 1 ]
  this.lineTickColor  = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]

  this.gridEnable     = [ true, true, true ]
  this.gridWidth      = [ 1, 1, 1 ]
  this.gridColor      = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]

  this.zeroEnable     = [ true, true, true ]
  this.zeroLineColor  = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]
  this.zeroLineWidth  = [ 2, 2, 2 ]

  this.backgroundEnable = [ false, false, false ]
  this.backgroundColor  = [ [0.8, 0.8, 0.8, 0.5], 
                            [0.8, 0.8, 0.8, 0.5], 
                            [0.8, 0.8, 0.8, 0.5] ]

  this._firstInit = true
  this._text  = null
  this._lines = null
  this._background = createBackground(gl)
}

var proto = Axes.prototype

proto.update = function(options) {
  options = options || {}

  //Option parsing helper functions
  function parseOption(nest, cons, name) {
    if(name in options) {
      var opt = options[name]
      var prev = this[name]
      var next
      if(nest ? (Array.isArray(opt) && Array.isArray(opt[0])) :
                 Array.isArray(opt) ) {
        this[name] = next = [ cons(opt[0]), cons(opt[1]), cons(opt[2]) ]
      } else {
        this[name] = next = [ cons(opt), cons(opt), cons(opt) ]
      }
      for(var i=0; i<3; ++i) {
        if(next[i] !== prev[i]) {
          return true
        }
      }
    }
    return false
  }

  var NUMBER  = parseOption.bind(this, false, Number)
  var BOOLEAN = parseOption.bind(this, false, Boolean)
  var STRING  = parseOption.bind(this, false, String)
  var COLOR   = parseOption.bind(this, true, function(v) {
    if(Array.isArray(v)) {
      if(v.length === 3) {
        return [ +v[0], +v[1], +v[2], 1.0 ]
      } else if(v.length === 4) {
        return [ +v[0], +v[1], +v[2], +v[3] ]
      }
    }
    return [ 0, 0, 0, 1 ]
  })

  //Tick marks and bounds
  var nextTicks
  var ticksUpdate   = false
  var boundsChanged = false
  if('bounds' in options) {
    var bounds = options.bounds
i_loop:
    for(var i=0; i<2; ++i) {
      for(var j=0; j<3; ++j) {
        if(bounds[i][j] !== this.bounds[i][j]) {
          boundsChanged = true
        }
        this.bounds[i][j] = bounds[i][j]
      }
    }
  }
  if('ticks' in options) {
    nextTicks      = options.ticks
    ticksUpdate    = true
    this.autoTicks = false
    for(var i=0; i<3; ++i) {
      this.tickSpacing[i] = 0.0
    }
  } else if(NUMBER('tickSpacing')) {
    this.autoTicks  = true
    boundsChanged   = true
  }

  if(this._firstInit) {
    if(!('ticks' in options || 'tickSpacing' in options)) {
      this.autoTicks = true
    }

    //Force tick recomputation on first update
    boundsChanged   = true
    ticksUpdate     = true
    this._firstInit = false
  }

  if(boundsChanged && this.autoTicks) {
    nextTicks = Ticks.create(this.bounds, this.tickSpacing)
    ticksUpdate = true
  }

  //Compare next ticks to previous ticks, only update if needed
  if(ticksUpdate) {
    for(var i=0; i<3; ++i) {
      nextTicks[i].sort(function(a,b) {
        return a.x-b.x
      })
    }
    if(Ticks.equal(nextTicks, this.ticks)) {
      ticksUpdate = false
    } else {
      this.ticks = nextTicks
    }
  }

  //Parse tick properties
  BOOLEAN('tickEnable')
  if(STRING('tickFont')) {
    ticksUpdate = true  //If font changes, must rebuild vbo
  }
  NUMBER('tickSize')
  NUMBER('tickAngle')
  NUMBER('tickPad')
  COLOR('tickColor')

  //Axis labels
  var labelUpdate = STRING('labels')
  if(STRING('labelFont')) {
    labelUpdate = true
  }
  BOOLEAN('labelEnable')
  NUMBER('labelSize')
  NUMBER('labelPad')
  COLOR('labelColor')

  //Axis lines
  BOOLEAN('lineEnable')
  BOOLEAN('lineMirror')
  NUMBER('lineWidth')
  COLOR('lineColor')

  //Axis line ticks
  BOOLEAN('lineTickEnable')
  BOOLEAN('lineTickMirror')
  NUMBER('lineTickLength')
  NUMBER('lineTickWidth')
  COLOR('lineTickColor')

  //Grid lines
  BOOLEAN('gridEnable')
  NUMBER('gridWidth')
  COLOR('gridColor')

  //Zero line
  BOOLEAN('zeroEnable')
  COLOR('zeroLineColor')
  NUMBER('zeroLineWidth')

  //Background
  BOOLEAN('backgroundEnable')
  COLOR('backgroundColor')

  //Update text if necessary
  if(!this._text) {
    this._text = createText(
      this.gl, 
      this.bounds,
      this.labels,
      this.labelFont,
      this.ticks,
      this.tickFont)
  } else if(this._text && (labelUpdate || ticksUpdate)) {
    this._text.update(
      this.bounds,
      this.labels,
      this.labelFont,
      this.ticks,
      this.tickFont)
  }
  
  //Update lines if necessary
  if(this._lines && ticksUpdate) {
    this._lines.dispose()
    this._lines = null
  }
  if(!this._lines) {
    this._lines = createLines(this.gl, this.bounds, this.ticks)
  }
}

function OffsetInfo() {
  this.primalOffset = [0,0,0]
  this.primalMinor  = [0,0,0]
  this.mirrorOffset = [0,0,0]
  this.mirrorMinor  = [0,0,0]
}

var LINE_OFFSET = [ new OffsetInfo(), new OffsetInfo(), new OffsetInfo() ]

function computeLineOffset(result, i, bounds, cubeEdges, cubeAxis) {
  var primalOffset = result.primalOffset
  var primalMinor  = result.primalMinor
  var dualOffset   = result.mirrorOffset
  var dualMinor    = result.mirrorMinor
  var e = cubeEdges[i]

  //Calculate offsets
  for(var j=0; j<3; ++j) {
    if(i === j) {
      continue
    }
    var a = primalOffset, 
        b = dualOffset,
        c = primalMinor,
        d = dualMinor
    if(e & (1<<j)) {
      a = dualOffset
      b = primalOffset
      c = dualMinor
      d = primalMinor
    }
    a[j] = bounds[0][j]
    b[j] = bounds[1][j]
    if(cubeAxis[j] > 0) {
      c[j] = -1
      d[j] = 0
    } else {
      c[j] = 0
      d[j] = +1
    }
  }
}

var CUBE_ENABLE = [0,0,0]
var DEFAULT_PARAMS = {
  model:      identity,
  view:       identity,
  projection: identity
}

proto.isOpaque = function() {
  return true
}

proto.isTransparent = function() {
  return this.backgroundEnable[0] ||
         this.backgroundEnable[1] ||
         this.backgroundEnable[2]
}

proto.drawTransparent = function(params) {
  var cubeEnable = CUBE_ENABLE
  for(var i=0; i<3; ++i) {
    if(this.backgroundEnable[i]) {
      cubeEnable[i] = cubeAxis[i]
    } else {
      cubeEnable[i] = 0
    }
  }
  this._background.draw(
    params.model || identity, 
    params.view || identity, 
    params.projection || identity, 
    this.bounds, 
    cubeEnable,
    this.backgroundColor)
}


var PRIMAL_MINOR  = [0,0,0]
var MIRROR_MINOR  = [0,0,0]
var PRIMAL_OFFSET = [0,0,0]

proto.draw = function(params) {
  params = params || DEFAULT_PARAMS

  //Geometry for camera and axes
  var model       = params.model || identity
  var view        = params.view || identity
  var projection  = params.projection || identity
  var bounds      = this.bounds

  //Unpack axis info
  var cubeParams  = getCubeProperties(model, view, projection, bounds)
  var cubeEdges   = cubeParams.cubeEdges
  var cubeAxis    = cubeParams.axis

  for(var i=0; i<3; ++i) {
    this.lastCubeProps.cubeEdges[i] = cubeEdges[i]
    this.lastCubeProps.axis[i] = cubeAxis[i]
  }

  //Compute axis info
  var lineOffset  = LINE_OFFSET
  for(var i=0; i<3; ++i) {
    computeLineOffset(
      LINE_OFFSET[i], 
      i, 
      this.bounds, 
      cubeEdges, 
      cubeAxis)
  }

  //Set up state parameters
  var gl = this.gl

  //Draw lines
  this._lines.bind(
    model,
    view,
    projection,
    this)

  //First draw grid lines and zero lines
  for(var i=0; i<3; ++i) {
    var x = [0,0,0]
    if(cubeAxis[i] > 0) {
      x[i] = bounds[1][i]
    } else {
      x[i] = bounds[0][i]
    }

    //Draw grid lines
    for(var j=0; j<2; ++j) {
      var u = (i + 1 + j) % 3
      var v = (i + 1 + (j^1)) % 3
      if(this.gridEnable[u]) {
        gl.lineWidth(this.gridWidth[u])
        this._lines.drawGrid(u, v, this.bounds, x, this.gridColor[u])
      }
    }

    //Draw zero lines (need to do this AFTER all grid lines are drawn)
    for(var j=0; j<2; ++j) {
      var u = (i + 1 + j) % 3
      var v = (i + 1 + (j^1)) % 3
      if(this.zeroEnable[v]) {
        //Check if zero line in bounds
        if(bounds[0][v] <= 0 && bounds[1][v] >= 0) {
          gl.lineWidth(this.zeroLineWidth[v])
          this._lines.drawZero(u, this.bounds, x, this.zeroLineColor[v])
        }
      }
    }
  }

  //Then draw axis lines and tick marks
  for(var i=0; i<3; ++i) {

    //Draw axis lines
    gl.lineWidth(this.lineWidth[i])
    if(this.lineEnable[i]) {
      this._lines.drawAxisLine(i, this.bounds, lineOffset[i].primalOffset, this.lineColor[i])
    }
    if(this.lineMirror[i]) {
      this._lines.drawAxisLine(i, this.bounds, lineOffset[i].mirrorOffset, this.lineColor[i])
    }

    //Compute minor axes
    var primalMinor = copyVec3(PRIMAL_MINOR, lineOffset[i].primalMinor)
    var mirrorMinor = copyVec3(MIRROR_MINOR, lineOffset[i].mirrorMinor)
    var tickLength  = this.lineTickLength
    for(var j=0; j<3; ++j) {
      var scaleFactor = 1.0 / model[5*j]
      primalMinor[j] *= tickLength[j] * scaleFactor
      mirrorMinor[j] *= tickLength[j] * scaleFactor
    }

    //Draw axis line ticks
    gl.lineWidth(this.lineTickWidth[i])
    if(this.lineTickEnable[i]) {
      this._lines.drawAxisTicks(i, lineOffset[i].primalOffset, primalMinor, this.lineTickColor[i])
    }
    if(this.lineTickMirror[i]) {
      this._lines.drawAxisTicks(i, lineOffset[i].mirrorOffset, mirrorMinor, this.lineTickColor[i])
    }
  }

  //Draw text sprites
  this._text.bind(
    model,
    view,
    projection,
    this.pixelRatio)

  for(var i=0; i<3; ++i) {

    var minor      = lineOffset[i].primalMinor
    var offset     = copyVec3(PRIMAL_OFFSET, lineOffset[i].primalOffset)

    for(var j=0; j<3; ++j) {
      if(this.lineTickEnable[i]) {
        offset[j] += minor[j] * Math.max(this.lineTickLength[j], 0)
      }
    }

    //Draw tick text
    if(this.tickEnable[i]) {
      
      //Add tick padding
      for(var j=0; j<3; ++j) {
        offset[j] += minor[j] * this.tickPad[j] / model[5*j]
      }

      //Draw axis
      this._text.drawTicks(
        i, 
        this.tickSize[i], 
        this.tickAngle[i],
        offset,
        this.tickColor[i])
    }

    //Draw labels
    if(this.labelEnable[i]) {

      //Add label padding
      for(var j=0; j<3; ++j) {
        offset[j] += minor[j] * this.labelPad[j] / model[5*j]
      }
      offset[i] += 0.5 * (bounds[0][i] + bounds[1][i])

      //Draw axis
      this._text.drawLabel(
        i, 
        this.labelSize[i], 
        this.labelAngle[i],
        offset,
        this.labelColor[i])
    }
  }
}

proto.dispose = function() {
  this._text.dispose()
  this._lines.dispose()
  this._background.dispose()
}

function createAxes(gl, options) {
  var axes = new Axes(gl)
  axes.update(options)
  return axes
}