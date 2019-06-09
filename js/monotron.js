(function() {
  var Monotron, RibbonKeyboard, noteToFrequency,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  Monotron = (function() {
    function Monotron(context) {
      this.context = context;
      this.vco1 = this.context.createOscillator();
      this.vco2 = this.context.createOscillator();
      this.lfo = this.context.createOscillator();
      this.lfoGain = this.context.createGain();
      this.vcf = this.context.createBiquadFilter();
      this.output = this.context.createGain();
      this.vco1.connect(this.vcf);
      this.vco2.connect(this.output);
      this.vco2.connect(this.lfoGain);
      this.lfoGain.connect(this.vco1.frequency);
      this.vcf.connect(this.output);
      this.output.gain.value = 0;
      this.vco1.type = 'sawtooth';
      this.vco2.type = 'triangle';
      this.lfo.type = 'sawtooth';
      this.vcf.type = 'lowpass';
      this.vco1.start(this.context.currentTime);
      this.vco2.start(this.context.currentTime);
      this.lfo.start(this.context.currentTime);
    }

    Monotron.prototype.noteOn = function(frequency, frequency2, time) {
      if (time == null) {
        time = this.context.currentTime;
      }
      this.vco1.frequency.setValueAtTime(frequency, time);
      this.vco2.frequency.setValueAtTime(frequency2, time);
      return this.output.gain.linearRampToValueAtTime(1.0, time + 0.1);
    };

    Monotron.prototype.noteOff = function(time) {
      if (time == null) {
        time = this.context.currentTime;
      }
      return this.output.gain.linearRampToValueAtTime(0.0, time + 0.1);
    };

    Monotron.prototype.connect = function(target) {
      return this.output.connect(target);
    };

    return Monotron;

  })();

  RibbonKeyboard = (function() {
    function RibbonKeyboard($el, monotron) {
      var $key, $ul, note, _i,
        _this = this;
      this.$el = $el;
      this.monotron = monotron;
      this.click = __bind(this.click, this);
      this.minNote = 57;
      this.minNote2 = 57;
      $ul = $('<ul>');
      for (note = _i = 1; _i <= 18; note = ++_i) {
        $key = $('<li>');
        if (note === 2 || note === 5 || note === 7 || note === 10 || note === 12 || note === 14 || note === 17) {
          $key.addClass('accidental');
          $key.width(this.$el.width() / 20);
          $key.css('left', "-" + ($key.width() / 2) + "px");
          $key.css('margin-right', "-" + ($key.width()) + "px");
        } else if (note === 1 || note === 18) {
          $key.width(this.$el.width() / 20);
        } else {
          $key.width(this.$el.width() / 10);
        }
        $ul.append($key);
      }
      this.$el.append($ul);
      this.mouseDown = false;
      $ul.mousedown(function(e) {
        _this.mouseDown = true;
        return _this.click(e);
      });
      $ul.mouseup(function(e) {
        _this.mouseDown = false;
        return _this.monotron.noteOff();
      });
      $ul.mousemove(this.click);
    }

    RibbonKeyboard.prototype.click = function(e) {
      var max, max2, min, min2, offset, ratio;
      if (!this.mouseDown) {
        return;
      }
      offset = e.pageX - this.$el.offset().left;
      ratio = offset / this.$el.width();
      min = noteToFrequency(this.minNote);
      min2 = noteToFrequency(this.minNote2);
      max = noteToFrequency(this.minNote + 18);
      max2 = noteToFrequency(this.minNote2 + 18);
      return this.monotron.noteOn(ratio * (max - min) + min, ratio * (max2 - min2) + min2);
    };

    return RibbonKeyboard;

  })();

  noteToFrequency = function(note) {
    return Math.pow(2, (note - 69) / 12) * 440.0;
  };

  $(function() {
    var audioContext, keyboard, knopfs, masterGain, params, playNote, pressed;
    audioContext = new (typeof AudioContext !== "undefined" && AudioContext !== null ? AudioContext : webkitAudioContext)();
    window.monotron = new Monotron(audioContext);
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(audioContext.destination);
    monotron.connect(masterGain);
    keyboard = new RibbonKeyboard($('#keyboard'), monotron);
    params = {
      int: {
        param: monotron.lfoGain.gain,
        min: 0.5,
        max: 500.0
      },
      cutoff: {
        param: monotron.vcf.frequency,
        min: 0.001,
        max: 900.0,
        scale: 1.03
      },
      peak: {
        param: monotron.vcf.Q,
        min: 0.001,
        max: 1000.0,
        scale: 1.10
      }
    };
    knopfs = [];
    $('.knob input').each(function(i, knob) {
      var knopf, param;
      knopf = new Knob(knob, new Ui.P2());
      knopfs.push(knopf);
      param = params[knob.id];
      if (param != null) {
        return $(this).change(function(e) {
          var ratio, scale, value, _ref;
          scale = (_ref = param.scale) != null ? _ref : 1.05;
          ratio = Math.pow(scale, parseInt(knopf.value)) / Math.pow(scale, knopf.settings.max);
          value = ratio * (param.max - param.min) + param.min;
          return param.param.setValueAtTime(value, audioContext.currentTime);
        });
      } else if (knob.id === "pitch") {
        return $(this).change(function(e) {
          return keyboard.minNote = parseInt(knopf.value);
        });
      } else if (knob.id === "pitch2") {
        return $(this).change(function(e) {
          return keyboard.minNote2 = parseInt(knopf.value);
        });
      }
    });
    $('#osc').change(function(e) {
      var target;
      target = $(this).find(":selected").val();
      monotron.lfoGain.disconnect();
      if (target === "VCO1") {
        return monotron.vco2.disconnect();
      } else if (target === "VCO1+2") {
        return monotron.vco2.connect(monotron.vcf);
      }
    });
    $("#pitch").val(57);
    $("#pitch2").val(40);
    $("#int").val(30);
    $("#cutoff").val(72);
    $("#peak").val(57);
    $("#osc").val("VCO1+2");
    playNote = function(code) {
      var note, notes;
      notes = '1234567890qwertyuiopasdfghjklzxcvbnm';
      note = notes.indexOf(String.fromCharCode(code).toLowerCase()) % 18;
      if (note < 0) {
        note = code % 18;
      }
      return monotron.noteOn(noteToFrequency(57 + note));
    };
    pressed = [];
    $(window).keydown(function(e) {
      var code;
      code = e.keyCode;
      if (pressed.indexOf(code) === -1) {
        pressed.push(code);
      }
      return playNote(code);
    });
    $(window).keyup(function(e) {
      var code;
      code = e.keyCode;
      if (pressed.indexOf(code) >= 0) {
        pressed.splice(pressed.indexOf(code), 1);
      }
      if (pressed.length < 1) {
        return monotron.noteOff();
      } else {
        return playNote(pressed[pressed.length - 1]);
      }
    });
    return knopfs.forEach(function(knopf) {
      return knopf.changed(0);
    });
  });

}).call(this);
