/* global AFRAME Blob uploadcare */

var saveAs = require('../../vendor/saveas.js').saveAs;
const https = require('https');

AFRAME.registerSystem('painter', {
  init: function () {

    var mappings = {
      behaviours: {},
      mappings: {
        painting: {
          common: {
            'grip.down': 'undo',
            'trigger.changed': 'paint'
          },

          'vive-controls': {
            'axis.move': 'changeBrushSizeInc',
            'trackpad.touchstart': 'startChangeBrushSize',
            'menu.down': 'toggleMenu',

            // Teleport
            'trackpad.down': 'aim',
            'trackpad.up': 'teleport'
          },

          'oculus-touch-controls': {
            'axis.move': 'changeBrushSizeAbs',
            'abutton.down': 'toggleMenu',
            'xbutton.down': 'toggleMenu',

            // Teleport
            'ybutton.down': 'aim',
            'ybutton.up': 'teleport',

            'bbutton.down': 'aim',
            'bbutton.up': 'teleport'
          },

          'windows-motion-controls': {
            'axis.move': 'changeBrushSizeAbs',
            'menu.down': 'toggleMenu',

            // Teleport
            'trackpad.down': 'aim',
            'trackpad.up': 'teleport'
          },
        }
      }
    };

    this.sceneEl.addEventListener('loaded', function() {
      AFRAME.registerInputMappings(mappings);
      AFRAME.currentInputMapping = 'painting';
    });

    this.version = '1.2';
    this.brushSystem = this.sceneEl.systems.brush;
    this.showTemplateItems = true;

    function getUrlParams () {
      var match;
      var pl = /\+/g;  // Regex for replacing addition symbol with a space
      var search = /([^&=]+)=?([^&]*)/g;
      var decode = function (s) { return decodeURIComponent(s.replace(pl, ' ')); };
      var query = window.location.search.substring(1);
      var urlParams = {};

      match = search.exec(query);
      while (match) {
        urlParams[decode(match[1])] = decode(match[2]);
        match = search.exec(query);
      }
      return urlParams;
    }
    var urlParams = getUrlParams();
    if (urlParams.url || urlParams.urljson) {
      var isBinary = urlParams.urljson === undefined;
      this.brushSystem.loadFromUrl(urlParams.url || urlParams.urljson, isBinary);
      document.getElementById('logo').setAttribute('visible', false);
      document.getElementById('acamera').setAttribute('orbit-controls', 'position', '0 1.6 3');
      document.getElementById('apainter-logo').classList.remove('hidden');
      //document.getElementById('apainter-author').classList.remove('hidden'); // not used yet
    }

    if (urlParams.bgcolor !== undefined) {
      document.body.style.backgroundColor = '#' + urlParams.bgcolor;
    }
    if (urlParams.sky !== undefined) {
      this.sceneEl.addEventListener('loaded', function (evt) {
        if (urlParams.sky === '') {
          document.getElementById('sky').setAttribute('visible', false);
        } else {
          document.getElementById('sky').setAttribute('material', 'src', urlParams.sky);
        }
      });
    }
    if (urlParams.floor !== undefined) {
      this.sceneEl.addEventListener('loaded', function (evt) {
        if (urlParams.floor === '') {
          document.getElementById('ground').setAttribute('visible', false);
        } else {
          document.getElementById('ground').setAttribute('material', 'src', urlParams.floor);
        }
      });
    }

    this.startPainting = false;
    var self = this;
    document.addEventListener('stroke-started', function (event) {
      if (!self.startPainting) {
        var logo = document.getElementById('logo');
        var mesh = logo.getObject3D('mesh');
        var tween = new AFRAME.TWEEN.Tween({ alpha: 1.0 })
          .to({alpha: 0.0}, 4000)
          .onComplete(function () {
            logo.setAttribute('visible', false);
          })
          .onUpdate(function () {
            mesh.children[0].material.opacity = this.alpha;
          }).start();
        self.startPainting = true;
      }
    });

    // @fixme This is just for debug until we'll get some UI
    document.addEventListener('keyup', function (event) {
      if(event.shiftKey || event.ctrlKey) return;
      if (event.keyCode === 8) {
        // Undo (Backspace)
        self.brushSystem.undo();
      }
      if (event.keyCode === 67) {
        // Clear (c)
        self.brushSystem.clear();
      }
      if (event.keyCode === 71) {
        // Export to GTF (g)
        var drawing = document.querySelector('.a-drawing');
        self.sceneEl.systems['gltf-exporter'].export(drawing);
      }
      if (event.keyCode === 78) {
        // Next brush (n)
        var hands = document.querySelectorAll('[paint-controls]');
        var brushesNames = Object.keys(AFRAME.BRUSHES);
        var index = brushesNames.indexOf(hands[0].components.brush.data.brush);
        index = (index + 1) % brushesNames.length;
        [].forEach.call(hands, function (hand) {
          hand.setAttribute('brush', 'brush', brushesNames[index]);
        });
      }

      if (event.keyCode === 84) {
        // Random stroke (t)
        self.brushSystem.generateTestLines();
      }

      if (event.keyCode === 82) {
        // Random stroke (r)
        self.brushSystem.generateRandomStrokes(1);
      }
      if (event.keyCode === 76) {
        // load binary from file (l)
        self.brushSystem.loadFromUrl('demo.apa', true);
      }
      if (event.keyCode === 85) { // u - upload
        self.upload();
      }
      if (event.keyCode === 86) { // v - save
        self.save();
      }
      if (event.keyCode === 74) { // j - save json
        self.saveJSON();
      }
      if (event.keyCode === 79) { // o - toggle template objects+images visibility
        self.showTemplateItems = !self.showTemplateItems;
        var templateItems = document.querySelectorAll('.templateitem');
        for (var i = 0; i < templateItems.length; i++) {
            templateItems[i].setAttribute('visible', self.showTemplateItems);
        }
      }
      if (event.keyCode === 88) { // x remove 2nd
        self.brushSystem.removeById(2);
      }
    });

    console.info('A-PAINTER Version: ' + this.version);
  },
  improv: function() {
    var json = this.brushSystem.getJSON();
    var sk_rnn0 = [];
    var sk_rnn1 = [];
    var i;
    var j;
    for (i=0; i < json.strokes.length;i++){
      var l0 = json.strokes[i].points[0].position[0];
      var l1 = json.strokes[i].points[0].position[1];
      for (j = 1; j < json.strokes[i].points.length; j++){
        sk_rnn0.push(json.strokes[i].points[j].position[0] - l0 );
        sk_rnn1.push(json.strokes[i].points[j].position[1] - l1 );
      }
    }
    var final_inp = '';
    var l_x = sk_rnn0[0];
    var l_y = sk_rnn1[0];
    for(i=1;i< sk_rnn0.length; i= i + 10){
      final_inp += '['+(l_x - sk_rnn0[i]) * 100+', '+(l_y - sk_rnn1[i]) * 100+',1,0,0],'
      l_x = sk_rnn0[i]
      l_y = sk_rnn1[i]
    }
    // final input is ready!
    console.log("inputbelow:");
    console.log(final_inp);
    console.log("outputbelow:")
    var u = 'http://localhost:8000/simple_predict?strokes=['+(final_inp.substring(0,final_inp.length - 1))+']';
    
    var finalUrl = u; //change to accept 2d strokes from the current stroke
    https.get(finalUrl, (resp) => {
      let data = '';
      resp.on('data', (chunk) => {
        data += chunk;
      });
      resp.on('end', () => {
        // reply received in data
        // convert it to loadJSON's argument!
        // console.log(data)
        var value = JSON.parse(data);
        console.log(value);
        // dx and dy to world coordinates (for debugging)
        var sk1_rnn0 = [];
        var sk1_rnn1 = [];

        var l_x = value[0][0]/100;
        var l_y = value[0][1]/100;
        for (i = 1; i < value.length; i++){
          sk1_rnn0.push( l_x - value[i][0] / 100 );
          sk1_rnn1.push( l_y - value[i][1] / 100 );
          l_x = l_x - value[i][0] / 100;
          l_y = l_y - value[i][1] / 100;
        }
        // sk1_rnn0.push(l_x - value[i][0]/100);
        // sk1_rnn1.push(l_y - value[i][1]/100);
        // world coordinates to JSON object that a-painter understands
        var prev_timestep = json.strokes[ json.strokes.length - 1 ].points[ json.strokes[json.strokes.length - 1].points.length - 1 ].timestamp;
        var prev_orientation = json.strokes[ json.strokes.length - 1 ].points[ json.strokes[json.strokes.length - 1].points.length - 1 ].orientation;
        var prev_x = json.strokes[ json.strokes.length - 1 ].points[ json.strokes[json.strokes.length - 1].points.length - 1 ].position[0];
        var prev_y = json.strokes[ json.strokes.length - 1 ].points[ json.strokes[json.strokes.length - 1].points.length - 1 ].position[1];
        var prev_z = json.strokes[ json.strokes.length - 1 ].points[ json.strokes[json.strokes.length - 1].points.length - 1 ].position[2];
        var prev_index = json.strokes[ json.strokes.length - 1 ].brush.index;
        var prev_brush_color = json.strokes[ json.strokes.length - 1 ].brush.color;
        var prev_size = json.strokes[ json.strokes.length - 1 ].brush.size;
        var prev_pressure = 1.0;
        var cur_stroke = {"brush": {"index": prev_index, "color":prev_brush_color, "size":prev_size }, "points":[] };
        for (i=0; i<value.length; i += 1){
          if(value[i][2] == 1){
            var pos = [ prev_x + sk1_rnn0[i], prev_y + sk1_rnn1[i], prev_z ];
            var temp_point = {"orientation":prev_orientation, "position":pos, "pressure":prev_pressure,"timestamp":prev_timestep+1};
            cur_stroke.points.push(temp_point);
          }
          else if (value[i][3] == 1){
            var pos = [ prev_x + sk1_rnn0[i], prev_y + sk1_rnn1[i], prev_z ];
            var temp_point = {"orientation":prev_orientation, "position":pos, "pressure":prev_pressure,"timestamp":prev_timestep+1};
            cur_stroke.points.push(temp_point);
            if (i < value.length-2){
              json.strokes.push(cur_stroke);
              cur_stroke = {"brush": {"index": prev_index, "color":prev_brush_color, "size":prev_size }, "points":[] };
            }
          }
          else {
            var pos = [ prev_x + sk1_rnn0[i], prev_y + sk1_rnn1[i], prev_z ];
            var temp_point = {"orientation":prev_orientation, "position":pos, "pressure":prev_pressure,"timestamp":prev_timestep+1};
            cur_stroke.points.push(temp_point);
            json.strokes.push(cur_stroke);
            break;
          }
          prev_timestep += 1
        }

        // load json
        this.brushSystem.loadJSON(json);
      });
    }).on("error", (err) => {
      console.log("Error: " + err.message)});

  },
  saveJSON: function () {
    var json = this.brushSystem.getJSON();
    var blob = new Blob([JSON.stringify(json)], {type: 'application/json'});
    saveAs(blob, 'demo.json');
  },
  save: function () {
    var dataviews = this.brushSystem.getBinary();
    var blob = new Blob(dataviews, {type: 'application/octet-binary'});
    saveAs(blob, 'demo.apa');
  },
  upload: function (success, error) {
    this.sceneEl.emit('drawing-upload-started');
    var self = this;

    var baseUrl = 'https://aframe.io/a-painter/?urljson=';

    var dataviews = this.brushSystem.getJSON();
    var blob = new Blob([JSON.stringify(dataviews)], {type: 'application/json'});
    var uploader = 'uploadcare'; // or 'fileio'
    if (uploader === 'fileio') {
      // Using file.io
      var fd = new window.FormData();
      fd.append('file', blob);
      var xhr = new window.XMLHttpRequest();
      xhr.open('POST', 'https://file.io'); // ?expires=1y
      xhr.onreadystatechange = function (data) {
        if (xhr.readyState === 4) {
          var response = JSON.parse(xhr.response);
          if (response.success) {
            console.log('Uploaded link: ', baseUrl + response.link);
            self.sceneEl.emit('drawing-upload-completed', {url: baseUrl + response.link});
            if (success) { success(); }
          }
        } else {
          self.sceneEl.emit('drawing-upload-error', {errorInfo: null, fileInfo: null});
          if (error) { error(); }
        }
      };
      xhr.send(fd);
    } else {
      var file = uploadcare.fileFrom('object', blob);
      file.done(function (fileInfo) {
        console.log('Uploaded link: ', baseUrl + fileInfo.cdnUrl);
        self.sceneEl.emit('drawing-upload-completed', {url: baseUrl + fileInfo.cdnUrl});
        if (success) { success(); }
      }).fail(function (errorInfo, fileInfo) {
        self.sceneEl.emit('drawing-upload-error', {errorInfo: errorInfo, fileInfo: fileInfo});
        if (error) { error(errorInfo); }
      }).progress(function (uploadInfo) {
        self.sceneEl.emit('drawing-upload-progress', {progress: uploadInfo.progress});
      });
    }
  }
});
