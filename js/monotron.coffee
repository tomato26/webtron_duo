class Monotron
  constructor: (@context) ->
    @vco1 = @context.createOscillator()
    @vco2 = @context.createOscillator()
    @lfo = @context.createOscillator()
    @lfoGain = @context.createGain()
    @vcf = @context.createBiquadFilter()
    @output = @context.createGain()

    @vco1.connect @vcf
    @vco2.connect @output
    @vco2.connect @lfoGain
    # @lfo.connect @lfoGain
    @lfoGain.connect @vco1.frequency
    @vcf.connect @output

    @output.gain.value = 0
    @vco1.type = 'sawtooth'
    @vco2.type = 'triangle'
    @lfo.type = 'sawtooth'
    @vcf.type = 'lowpass'
    @vco1.start @context.currentTime
    @vco2.start @context.currentTime
    @lfo.start @context.currentTime

  noteOn: (frequency,frequency2, time) ->
    time ?= @context.currentTime
    @vco1.frequency.setValueAtTime frequency, time 
    @vco2.frequency.setValueAtTime frequency2, time
    @output.gain.linearRampToValueAtTime 1.0, time + 0.1

  noteOff: (time) ->
    time ?= @context.currentTime
    @output.gain.linearRampToValueAtTime 0.0, time + 0.1

  connect: (target) ->
    @output.connect target

class RibbonKeyboard
  constructor: (@$el, @monotron) ->
    @minNote = 57
    @minNote2 = 57
    $ul = $('<ul>')
    for note in [1..18]
      $key = $('<li>')
      if note in [2, 5, 7, 10, 12, 14, 17]
        $key.addClass 'accidental'
        $key.width (@$el.width() / 20)
        $key.css 'left', "-#{$key.width() / 2}px"
        $key.css 'margin-right', "-#{$key.width()}px"
      else if note in [1, 18]
        $key.width (@$el.width() / 20)
      else
        $key.width (@$el.width() / 10)
      $ul.append $key
    @$el.append $ul

    @mouseDown = false
    $ul.mousedown (e) =>
      @mouseDown = true
      @click(e)
    $ul.mouseup (e) =>
      @mouseDown = false
      @monotron.noteOff()
    $ul.mousemove @click

  click: (e) =>
    return unless @mouseDown
    offset =  e.pageX - @$el.offset().left
    ratio = offset / @$el.width()
    min = noteToFrequency @minNote
    min2 = noteToFrequency @minNote2
    max = noteToFrequency (@minNote + 18)
    max2 = noteToFrequency (@minNote2 + 18)
    @monotron.noteOn ratio * (max - min) + min, ratio * (max2 - min2) + min2

noteToFrequency = (note) ->
  Math.pow(2, (note - 69) / 12) * 440.0

$ ->
  audioContext = new (AudioContext ? webkitAudioContext)()
  window.monotron = new Monotron(audioContext)
  masterGain = audioContext.createGain()
  masterGain.gain.value = 0.7 # to prevent clipping
  masterGain.connect audioContext.destination
  monotron.connect masterGain

  keyboard = new RibbonKeyboard($('#keyboard'), monotron)

  params =
    # rate:
    #   param: monotron.lfo.frequency
    #   min: 0.001
    #   max: 900.0
    #   scale: 1.1
    int:
      param: monotron.lfoGain.gain
      min: 0.5
      max: 500.0
    cutoff:
      param: monotron.vcf.frequency
      min: 0.001
      max: 900.0
      scale: 1.03
    peak:
      param: monotron.vcf.Q
      min: 0.001
      max: 1000.0
      scale: 1.10

  knopfs = []
  $('.knob input').each (i, knob) ->
    knopf = new Knob(knob, new Ui.P2())
    knopfs.push knopf
    param = params[knob.id]
    if param?
      $(@).change (e) ->
        # convert to log scale
        scale = param.scale ? 1.05
        ratio = Math.pow(scale, parseInt(knopf.value)) / Math.pow(scale, knopf.settings.max)
        value = ratio * (param.max - param.min) + param.min
        param.param.setValueAtTime value, audioContext.currentTime
    else if knob.id == "pitch"
      $(@).change (e) ->
        keyboard.minNote = parseInt knopf.value
    else if knob.id == "pitch2"
      $(@).change (e) ->
        keyboard.minNote2 = parseInt knopf.value 

  $('#osc').change (e) ->
    target = $(this).find(":selected").val()
    monotron.lfoGain.disconnect()
    if target is "VCO1"
      monotron.vco2.disconnect()
    else if target is "VCO1+2"
      monotron.vco2.connect(monotron.vcf)

  # the initial "patch"
  $("#pitch").val 57
  $("#pitch2").val 40
  $("#int").val 30
  $("#cutoff").val 72
  $("#peak").val 57
  $("#osc").val "VCO1+2"

  # play note based on keyboard's keyCodes
  playNote = (code) ->
    # change this string to match qwerty layout to notes
    notes = '1234567890qwertyuiopasdfghjklzxcvbnm'
    note = notes.indexOf(String.fromCharCode(code).toLowerCase()) % 18
    if note < 0 then note = code % 18
    monotron.noteOn noteToFrequency 57 + note

  # handle key press events
  pressed = []
  $(window).keydown (e) ->
    code = e.keyCode
    if pressed.indexOf(code) == -1 then pressed.push code
    playNote code
  $(window).keyup (e) ->
    code = e.keyCode
    if pressed.indexOf(code) >= 0 then pressed.splice(pressed.indexOf(code), 1)
    if pressed.length < 1 then monotron.noteOff() else playNote pressed[pressed.length - 1]

  knopfs.forEach (knopf) ->
    knopf.changed 0
