#!/usr/bin/node

'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const manifest = require(path.join(root, 'manifest.json'))
const runtimeDir = path.dirname(manifest.entryPoints.service)
const Detector = require(path.join(root, runtimeDir, 'models/HardwareKeyboardDetector.js'))
const Policy = require(path.join(root, runtimeDir, 'models/KeyboardPolicy.js'))
const Layout = require(path.join(root, runtimeDir, 'models/KeyboardLayout.js'))
const Mapper = require(path.join(root, runtimeDir, 'models/KeyMapper.js'))
const Dispatch = require(path.join(root, runtimeDir, 'models/KeyDispatch.js'))
const Avoidance = require(path.join(root, runtimeDir, 'models/WindowAvoidance.js'))
const us = require(path.join(root, 'layouts/en-us.json'))

function test(name, fn) {
  try {
    fn()
    process.stdout.write(`ok - ${name}\n`)
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n${error.stack}\n`)
    process.exitCode = 1
  }
}

function rawSwitch(data, parsed) {
  return {
    name: 'switch',
    data,
    parse(count) {
      assert.equal(count, 2)
      return parsed
    }
  }
}

test('switch parser normalizes on and off events', () => {
  assert.deepEqual(Detector.parseSwitchEvent(rawSwitch('on,Tablet Mode', ['on', 'Tablet Mode'])), {
    available: true,
    active: true,
    source: 'hyprland-switch',
    name: 'Tablet Mode'
  })
  assert.deepEqual(Detector.parseSwitchEvent(rawSwitch('off,Asus WMI hotkeys', ['off', 'Asus WMI hotkeys'])), {
    available: true,
    active: false,
    source: 'hyprland-switch',
    name: 'Asus WMI hotkeys'
  })
})

test('switch parser accepts the raw-data fallback and commas in names', () => {
  const event = { name: 'switch', data: 'on,Tablet Mode, chassis' }
  assert.deepEqual(Detector.parseSwitchEvent(event), {
    available: true,
    active: true,
    source: 'hyprland-switch',
    name: 'Tablet Mode, chassis'
  })
})

test('switch parser ignores malformed parse results and falls back to raw data', () => {
  for (const parsed of ['on', { 0: 'on', 1: 'Tablet Mode', length: 2 }]) {
    assert.deepEqual(Detector.parseSwitchEvent(rawSwitch('on,Tablet Mode', parsed)), {
      available: true,
      active: true,
      source: 'hyprland-switch',
      name: 'Tablet Mode'
    })
  }
})

test('switch parser rejects unrelated and malformed events', () => {
  const rejected = [
    null,
    {},
    { name: 'openwindow', data: 'on,Tablet Mode' },
    { name: 'switch', data: 'toggle,Tablet Mode' },
    { name: 'switch', data: 'on,' },
    { name: 'switch', data: 'on,Lid Switch' },
    { name: 'switch', data: 'on,random-switch' }
  ]
  for (const event of rejected) assert.equal(Detector.parseSwitchEvent(event), null)
})

test('convertible switch matching is generic while retaining the ASUS fixture', () => {
  assert.equal(Detector.isConvertibleSwitchName('Tablet Mode'), true)
  assert.equal(Detector.isConvertibleSwitchName('Convertible tablet switch'), true)
  assert.equal(Detector.isConvertibleSwitchName('Keyboard Folded'), true)
  assert.equal(Detector.isConvertibleSwitchName('Asus WMI hotkeys'), true)
  assert.equal(Detector.isConvertibleSwitchName('Lid Switch'), false)
})

test('Z13 keyboard inventory detects attach, detach, and external-keyboard recovery', () => {
  const base = {
    switches: [{ name: 'Asus WMI hotkeys' }],
    keyboards: [
      { name: 'video-bus' },
      { name: 'gpio-keys' },
      { name: 'power-button' },
      { name: 'asus-wmi-hotkeys' },
      { name: 'at-translated-set-2-keyboard' },
      { name: 'hl-virtual-keyboard-fcitx5' }
    ]
  }
  assert.deepEqual(Detector.fromDeviceInventory({
    ...base,
    keyboards: base.keyboards.concat({ name: 'asustek-computer-inc.-n-key-device' })
  }), {
    available: true, active: false, source: 'hyprland-devices', name: 'Asus WMI hotkeys'
  })
  assert.deepEqual(Detector.fromDeviceInventory(base), {
    available: true, active: true, source: 'hyprland-devices', name: 'Asus WMI hotkeys'
  })
  assert.deepEqual(Detector.fromDeviceInventory({
    ...base,
    keyboards: base.keyboards.concat({ name: 'keychron-k3' })
  }), {
    available: true, active: false, source: 'hyprland-devices', name: 'Asus WMI hotkeys'
  })
  assert.equal(Detector.fromDeviceInventory({ switches: [], keyboards: [] }), null)
})

test('policy starts safely unknown in auto mode', () => {
  assert.deepEqual(Policy.create(), {
    mode: 'auto',
    detector: { available: false, active: false, source: 'unknown', name: '' },
    visible: false
  })
  assert.equal(Policy.keyboardEnabled(Policy.create()), false)
})

test('policy normalizes malformed external state without throwing', () => {
  assert.equal(Policy.keyboardEnabled({ mode: 'auto' }), false)
  assert.deepEqual(Policy.reduce({ mode: 'invalid', visible: true }, { type: 'unknown' }), Policy.create())
  assert.equal(Policy.label({ mode: 'auto' }), 'AUTO · DETECTOR UNKNOWN')
})

test('auto follows valid detector state and ignores invalid transitions', () => {
  let state = Policy.create()
  state = Policy.reduce(state, { type: 'detector', detector: { available: true, active: true, source: 'hyprland-switch', name: 'Tablet Mode' } })
  assert.equal(Policy.keyboardEnabled(state), true)
  assert.equal(state.visible, true)
  const same = Policy.reduce(state, { type: 'mode', mode: 'sometimes' })
  assert.deepEqual(same, state)
  state = Policy.reduce(state, { type: 'detector', detector: { available: true, active: false, source: 'hyprland-switch', name: 'Tablet Mode' } })
  assert.equal(Policy.keyboardEnabled(state), false)
  assert.equal(state.visible, false)
})

test('forced on and off are deterministic and auto resumes detector truth', () => {
  let state = Policy.reduce(Policy.create(), { type: 'mode', mode: 'on' })
  assert.equal(Policy.keyboardEnabled(state), true)
  assert.equal(state.visible, true)
  state = Policy.reduce(state, { type: 'mode', mode: 'off' })
  assert.equal(Policy.keyboardEnabled(state), false)
  assert.equal(state.visible, false)
  state = Policy.reduce(state, { type: 'detector', detector: { available: true, active: true, source: 'hyprland-switch', name: 'Tablet Mode' } })
  assert.equal(state.visible, false)
  state = Policy.reduce(state, { type: 'mode', mode: 'auto' })
  assert.equal(state.visible, true)
})

test('manual show hide and toggle remain available when detection is unknown', () => {
  let state = Policy.reduce(Policy.create(), { type: 'show' })
  assert.equal(state.mode, 'on')
  assert.equal(state.visible, true)
  state = Policy.reduce(state, { type: 'toggle' })
  assert.equal(state.mode, 'off')
  assert.equal(state.visible, false)
  state = Policy.reduce(state, { type: 'toggle' })
  assert.equal(state.mode, 'on')
  assert.equal(state.visible, true)
  state = Policy.reduce(state, { type: 'hide' })
  assert.deepEqual({ mode: state.mode, visible: state.visible }, { mode: 'off', visible: false })
})

test('off can never be visible and on can never be hidden', () => {
  const detector = { available: true, active: true, source: 'fixture', name: 'Tablet Mode' }
  let state = Policy.reduce({ mode: 'off', detector, visible: true }, { type: 'detector', detector })
  assert.deepEqual({ mode: state.mode, visible: state.visible }, { mode: 'off', visible: false })
  state = Policy.reduce({ mode: 'on', detector, visible: false }, { type: 'detector', detector: { ...detector, active: false } })
  assert.deepEqual({ mode: state.mode, visible: state.visible }, { mode: 'on', visible: true })
})

test('auto follows reattach while on remains forced', () => {
  const detached = { available: true, active: true, source: 'fixture', name: 'Tablet Mode' }
  const attached = { ...detached, active: false }
  let automatic = Policy.reduce(Policy.create(), { type: 'detector', detector: detached })
  let forced = Policy.reduce(automatic, { type: 'mode', mode: 'on' })
  automatic = Policy.reduce(automatic, { type: 'detector', detector: attached })
  forced = Policy.reduce(forced, { type: 'detector', detector: attached })
  assert.equal(automatic.visible, false)
  assert.equal(forced.visible, true)
})

test('policy labels explain automatic and forced states', () => {
  assert.equal(Policy.label(Policy.create()), 'AUTO · DETECTOR UNKNOWN')
  assert.equal(Policy.label({ mode: 'auto', detector: { available: true, active: false }, visible: false }), 'AUTO · KEYBOARD ATTACHED')
  assert.equal(Policy.label({ mode: 'auto', detector: { available: true, active: true }, visible: true }), 'AUTO · KEYBOARD DETACHED')
  assert.equal(Policy.label({ mode: 'on', detector: {}, visible: true }), 'ON · FORCED')
  assert.equal(Policy.label({ mode: 'off', detector: {}, visible: false }), 'OFF')
})

test('US layout contains every supported key family', () => {
  const model = Layout.build(us)
  assert.equal(model.id, 'en-us')
  assert(model.rows.length >= 5)
  const ids = model.rows.flat().concat(model.navigation.keys).map(key => key.id)
  for (const id of [
    'a', 'z', 'shift', 'ctrl', 'alt', 'super', 'digit1', 'digit0', 'minus', 'equal', 'comma', 'period',
    'slash', 'semicolon', 'apostrophe', 'bracketleft', 'bracketright', 'backslash',
    'space', 'backspace', 'enter', 'tab', 'escape', 'left', 'right', 'up', 'down'
  ]) assert(ids.includes(id), `missing ${id}`)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(model.rowInsets, [0, 0.025, 0.05, 0.025, 0.08])
  assert.equal(model.rows.flat().find(key => key.id === 'super').fontFamily, 'omarchy')
})

test('layout-owned long-press alternatives expose developer symbols without changing the primary grid', () => {
  const model = Layout.build(us)
  const keys = new Map(model.rows.flat().map(key => [key.id, key]))
  const expected = {
    digit1: ['exclamation'], digit2: ['at'], digit3: ['hash'], digit4: ['dollar'],
    digit5: ['percent'], digit6: ['caret'], digit7: ['ampersand'], digit8: ['asterisk'],
    digit9: ['parenleft'], digit0: ['parenright'], minus: ['underscore'], equal: ['plus'],
    bracketleft: ['braceleft'], bracketright: ['braceright'], backslash: ['bar'],
    semicolon: ['colon'], apostrophe: ['doublequote'], comma: ['less'], period: ['greater'],
    slash: ['question'], grave: ['tilde']
  }
  for (const [id, alternatives] of Object.entries(expected)) {
    assert.deepEqual(keys.get(id).alternatives.map(key => key.id), alternatives, `${id} alternatives`)
    assert(keys.get(id).alternatives.every(key => key.kind === 'printable'))
  }
  assert.equal(keys.get('a').alternatives.length, 0)
})

test('layout rejects malformed or unsafe long-press alternatives', () => {
  const base = {
    id: 'fixture', rowInsets: [0],
    rows: [[{ id: 'a', kind: 'printable', label: 'a' }]],
    navigation: { type: 'inverted-t', keys: [
      { id: 'up', kind: 'action', label: 'up' }, { id: 'left', kind: 'action', label: 'left' },
      { id: 'down', kind: 'action', label: 'down' }, { id: 'right', kind: 'action', label: 'right' }
    ] }
  }
  for (const alternatives of [
    [{ id: '', kind: 'printable', label: '_' }],
    [{ id: 'shift', kind: 'modifier', label: 'Shift' }],
    [{ id: 'underscore', kind: 'printable', label: '_' }, { id: 'underscore', kind: 'printable', label: '_' }],
    [{ id: 'one', kind: 'printable', label: '1' }, { id: 'two', kind: 'printable', label: '2' },
      { id: 'three', kind: 'printable', label: '3' }, { id: 'four', kind: 'printable', label: '4' },
      { id: 'five', kind: 'printable', label: '5' }]
  ]) assert.throws(() => Layout.build({ ...base, rows: [[{ ...base.rows[0][0], alternatives }]] }))
  assert.throws(() => Layout.build({
    ...base,
    rows: [[{
      id: 'enter', kind: 'action', label: 'Enter',
      alternatives: [{ id: 'exclamation', kind: 'printable', label: '!' }]
    }]]
  }))
})

test('layout rejects malformed rows and non-finite key widths', () => {
  const navigation = {
    type: 'inverted-t',
    keys: [
      { id: 'up', kind: 'action', label: 'up' },
      { id: 'left', kind: 'action', label: 'left' },
      { id: 'down', kind: 'action', label: 'down' },
      { id: 'right', kind: 'action', label: 'right' }
    ]
  }

  assert.throws(() => Layout.build({ rows: [[{ id: 'a', kind: 'printable', label: 'a' }]], navigation }))
  assert.throws(() => Layout.build({ id: 'fixture', rows: [], navigation }))
  assert.throws(() => Layout.build({ id: 'fixture', rows: [null], navigation }))
  assert.throws(() => Layout.build({ id: 'fixture', rows: [[]], navigation }))
  assert.throws(() => Layout.build({
    id: 'fixture', rows: [[{ id: 'a', kind: 'printable', label: '' }]], navigation
  }))
  for (const width of [NaN, Infinity, -Infinity, 'wide']) {
    assert.throws(() => Layout.build({
      id: 'fixture',
      rows: [[{ id: 'a', kind: 'printable', label: 'a', width }]],
      navigation
    }))
  }
})

test('arrow keys are a closed inverted-T cluster outside the typing rows', () => {
  const model = Layout.build(us)
  assert.equal(model.navigation.type, 'inverted-t')
  assert.deepEqual(model.navigation.keys.map(key => key.id), ['up', 'left', 'down', 'right'])
  assert.equal(model.rows.flat().some(key => ['up', 'left', 'down', 'right'].includes(key.id)), false)
})

test('navigation cluster scales at 22 percent with touch-safe bounds', () => {
  assert.equal(Layout.navigationWidth(600, 150, 246), 150)
  assert.equal(Layout.navigationWidth(1000, 150, 246), 220)
  assert.equal(Layout.navigationWidth(1240, 150, 246), 246)
})

test('Hyprland gap parsing selects the actual bottom edge', () => {
  assert.equal(Avoidance.bottomOuterGap('{"css":"10"}', 5), 10)
  assert.equal(Avoidance.bottomOuterGap('{"css":"10 20"}', 5), 10)
  assert.equal(Avoidance.bottomOuterGap('{"css":"10 20 30"}', 5), 30)
  assert.equal(Avoidance.bottomOuterGap('{"css":"10 20 30 40"}', 5), 30)
  assert.equal(Avoidance.bottomOuterGap('{"css":"0 8 30 8"}', 5), 30)
  assert.equal(Avoidance.bottomOuterGap('not-json', 12), 12)
})

test('exclusive zone cancels the compositor bottom gap', () => {
  assert.equal(Avoidance.exclusiveZone(330, 10), 320)
  assert.equal(Avoidance.exclusiveZone(320, 0), 320)
  assert.equal(Avoidance.exclusiveZone(12, 10), 2)
  assert.equal(Avoidance.exclusiveZone('bad', 10), 0)
})

test('tiled seam correction closes only a plausible measured remainder', () => {
  const monitor = { x: 0, y: 0, width: 1280, height: 800 }
  assert.equal(Avoidance.tiledSeamCorrection({
    address: '0x1', floating: false, fullscreen: 0, at: [10, 30], size: [1260, 428]
  }, monitor, 480, 2, 96), 20)
  assert.equal(Avoidance.tiledSeamCorrection({
    address: '0x1', floating: false, fullscreen: 0, at: [10, 30], size: [1260, 448]
  }, monitor, 480, 2, 96), 0)
  assert.equal(Avoidance.tiledSeamCorrection({
    address: '0x1', floating: true, fullscreen: 0, at: [10, 30], size: [1260, 428]
  }, monitor, 480, 2, 96), 0)
  assert.equal(Avoidance.tiledSeamCorrection({
    address: '0x1', floating: false, fullscreen: 0, at: [10, 30], size: [1260, 200]
  }, monitor, 480, 2, 96), 0)
  assert.equal(Avoidance.tiledSeamCorrection({
    address: '0x1', floating: false, fullscreen: 0, at: [10, 30], size: [1260, 428]
  }, { x: 0, y: 800, width: 1280, height: 800 }, 480, 2, 96), 0)
})

test('window avoidance leaves tiled clients to the exclusive zone', () => {
  assert.deepEqual(Avoidance.plan({
    address: '0x1', floating: false, fullscreen: 0, at: [0, 0], size: [1280, 800]
  }, { x: 0, y: 0, width: 1280, height: 800 }, 520), {
    action: 'none', reason: 'exclusive-zone'
  })
})

test('window avoidance fits only overlapping floating clients above the keyboard', () => {
  assert.deepEqual(Avoidance.plan({
    address: '0x2', floating: true, fullscreen: 0, at: [100, 200], size: [900, 500]
  }, { x: 0, y: 0, width: 1280, height: 800 }, 520), {
    action: 'fit', address: '0x2', x: 100, y: 40, width: 900, height: 480,
    restore: { x: 100, y: 200, width: 900, height: 500, fullscreen: 0 }
  })
  assert.deepEqual(Avoidance.plan({
    address: '0x3', floating: true, fullscreen: 0, at: [100, 40], size: [900, 400]
  }, { x: 0, y: 0, width: 1280, height: 800 }, 520), {
    action: 'none', reason: 'clear'
  })
})

test('window avoidance exits fullscreen reversibly instead of covering it', () => {
  assert.deepEqual(Avoidance.plan({
    address: '0x4', floating: true, fullscreen: 1, at: [0, 0], size: [1280, 800]
  }, { x: 0, y: 0, width: 1280, height: 800 }, 520), {
    action: 'unfullscreen', address: '0x4',
    restore: { x: 0, y: 0, width: 1280, height: 800, fullscreen: 1 }
  })
})

test('window avoidance rejects a keyboard edge outside the target monitor', () => {
  assert.deepEqual(Avoidance.plan({
    address: '0x5', floating: true, fullscreen: 0, at: [100, 200], size: [900, 500]
  }, { x: 0, y: 0, width: 1280, height: 800 }, -10), {
    action: 'none', reason: 'invalid-geometry'
  })
  assert.deepEqual(Avoidance.plan({
    address: '0x5', floating: true, fullscreen: 0, at: [100, 200], size: [900, 500]
  }, { x: 0, y: 0, width: 1280, height: 800 }, 900), {
    action: 'none', reason: 'invalid-geometry'
  })
})

test('window avoidance refuses a fit when no safe client area remains', () => {
  assert.deepEqual(Avoidance.plan({
    address: '0x6', floating: true, fullscreen: 0, at: [20, 20], size: [500, 500]
  }, { x: 0, y: 0, width: 1280, height: 800 }, 100), {
    action: 'none', reason: 'insufficient-space'
  })
})

test('each supported modifier is independently one-shot and visibly latched', () => {
  let state = Layout.createState()
  for (const id of ['ctrl', 'alt', 'shift', 'super']) {
    const result = Layout.activate(state, { id, kind: 'modifier' })
    state = result.state
    assert.equal(Layout.modifierActive(state, id), true)
    assert.equal(result.action, null)
  }
  assert.equal(Layout.labelFor({ id: 'a', label: 'a', shifted: 'A' }, state), 'A')
  const result = Layout.activate(state, { id: 'a', kind: 'printable' })
  assert.deepEqual(result.action, { id: 'a', modifiers: ['ctrl', 'alt', 'shift', 'super'] })
  assert.deepEqual(result.state, Layout.createState())
})

test('one-shot modifiers apply to actions, toggle off, and cancel atomically', () => {
  let state = Layout.activate(Layout.createState(), { id: 'alt', kind: 'modifier' }).state
  let result = Layout.activate(state, { id: 'tab', kind: 'action' })
  assert.deepEqual(result.action, { id: 'tab', modifiers: ['alt'] })
  assert.deepEqual(result.state, Layout.createState())

  state = Layout.activate(Layout.createState(), { id: 'ctrl', kind: 'modifier' }).state
  state = Layout.activate(state, { id: 'ctrl', kind: 'modifier' }).state
  assert.equal(Layout.modifierActive(state, 'ctrl'), false)

  state = Layout.activate(Layout.createState(), { id: 'super', kind: 'modifier' }).state
  assert.deepEqual(Layout.cancel(state), Layout.createState())
})

test('strict mapper uses a named Space and argv-only modifier chords', () => {
  assert.deepEqual(Mapper.commandFor({ id: 'a', modifiers: [] }), ['wtype', 'a'])
  assert.deepEqual(Mapper.commandFor({ id: 'space', modifiers: [] }), ['wtype', '-k', 'space'])
  assert.deepEqual(Mapper.commandFor({ id: 'a', modifiers: ['shift'] }),
    ['wtype', '-M', 'shift', 'A', '-m', 'shift'])
  assert.deepEqual(Mapper.commandFor({ id: 'a', modifiers: ['ctrl', 'alt', 'shift', 'super'] }),
    ['wtype', '-M', 'ctrl', '-M', 'alt', '-M', 'shift', '-M', 'logo', 'A',
      '-m', 'logo', '-m', 'shift', '-m', 'alt', '-m', 'ctrl'])
  assert.deepEqual(Mapper.commandFor({ id: 'tab', modifiers: ['alt'] }),
    ['hyprctl', 'dispatch', 'hl.dsp.window.cycle_next()'])
  assert.deepEqual(Mapper.commandFor({ id: 'space', modifiers: ['alt', 'super'] }),
    ['omarchy-menu', 'toggle', 'apps'])
  assert.deepEqual(Mapper.commandFor({ id: 'space', modifiers: ['shift', 'super'] }),
    ['omarchy-toggle-bar'])
  assert.deepEqual(Mapper.commandFor({ id: 'space', modifiers: ['ctrl', 'super'] }),
    ['omarchy-menu', 'toggle', 'background'])
  assert.deepEqual(Mapper.commandFor({ id: 'space', modifiers: ['ctrl', 'shift', 'super'] }),
    ['omarchy-menu', 'toggle', 'theme'])
  assert.deepEqual(Mapper.commandFor({ id: 'space', modifiers: ['super'] }),
    ['omarchy-menu', 'toggle'])
  assert.deepEqual(Mapper.commandFor({ id: 'backspace', modifiers: [] }), ['wtype', '-k', 'BackSpace'])
  assert.deepEqual(Mapper.commandFor({ id: 'left', modifiers: [] }), ['wtype', '-k', 'Left'])
})

test('developer alternatives have closed fixed argv mappings and support one-shot chords', () => {
  const expected = {
    exclamation: '!', at: '@', hash: '#', dollar: '$', percent: '%', caret: '^',
    ampersand: '&', asterisk: '*', parenleft: '(', parenright: ')', underscore: '_', plus: '+',
    braceleft: '{', braceright: '}', bar: '|', colon: ':', doublequote: '"', less: '<',
    greater: '>', question: '?', tilde: '~'
  }
  for (const [id, symbol] of Object.entries(expected))
    assert.deepEqual(Mapper.commandFor({ id, modifiers: [] }), ['wtype', symbol], id)
  assert.deepEqual(Mapper.commandFor({ id: 'underscore', modifiers: ['ctrl'] }),
    ['wtype', '-M', 'ctrl', '_', '-m', 'ctrl'])
})

test('strict mapper refuses unknown ids, modifiers, duplicates, and malformed actions', () => {
  for (const action of [
    null,
    {},
    { id: '' },
    { id: 'a; touch /tmp/pwned', modifiers: [] },
    { id: 'unknown', modifiers: [] },
    { id: 'a', modifiers: 'ctrl' },
    { id: 'a', modifiers: ['hyper'] },
    { id: 'a', modifiers: ['ctrl', 'ctrl'] },
    { id: 'a', modifiers: ['shift', 'ctrl'] },
    { id: 'shift', modifiers: [] }
  ]) assert.equal(Mapper.commandFor(action), null)
})

test('every layout action crosses both closed input boundaries', () => {
  const layout = Layout.build(us)
  const keys = layout.rows.flat()
    .flatMap(key => [key, ...key.alternatives])
    .concat(layout.navigation.keys)
    .filter(key => key.kind !== 'modifier')
  const modifierSets = [[], ['ctrl'], ['alt'], ['shift'], ['super'], ['ctrl', 'alt', 'shift', 'super']]

  for (const key of keys) {
    for (const modifiers of modifierSets) {
      const command = Mapper.commandFor({ id: key.id, modifiers })
      assert(command, `${key.id} with ${modifiers.join('+') || 'no modifiers'} must map`)
      assert.equal(Dispatch.enqueue(Dispatch.create(), command, 1).accepted, true,
        `${key.id} with ${modifiers.join('+') || 'no modifiers'} must dispatch`)
    }
  }
})

test('dispatch serializes a rapid burst without dropping or combining actions', () => {
  const a = ['wtype', 'a']
  const space = ['wtype', '-k', 'space']
  const backspace = ['wtype', '-k', 'BackSpace']
  let state = Dispatch.create()
  let result = Dispatch.enqueue(state, a)
  state = result.state
  assert.deepEqual(result.start, a)
  result = Dispatch.enqueue(state, space)
  state = result.state
  assert.equal(result.start, null)
  result = Dispatch.enqueue(state, backspace)
  state = result.state
  assert.deepEqual(state.pending, [space, backspace])
  result = Dispatch.complete(state, 0)
  assert.deepEqual(result.start, space)
  result = Dispatch.complete(result.state, 0)
  assert.deepEqual(result.start, backspace)
  result = Dispatch.complete(result.state, 0)
  assert.equal(result.start, null)
  assert.deepEqual(result.state, Dispatch.create())
})

test('dispatch accepts only the closed compositor shortcut commands', () => {
  const allowed = [
    ['hyprctl', 'dispatch', 'hl.dsp.window.cycle_next()'],
    ['omarchy-menu', 'toggle'],
    ['omarchy-menu', 'toggle', 'apps'],
    ['omarchy-toggle-bar'],
    ['omarchy-menu', 'toggle', 'background'],
    ['omarchy-menu', 'toggle', 'theme']
  ]
  for (const command of allowed)
    assert.equal(Dispatch.enqueue(Dispatch.create(), command, 4).accepted, true)
  for (const command of [
    ['hyprctl', 'dispatch', 'exec', 'touch /tmp/no'],
    ['omarchy-menu', 'toggle', 'system'],
    ['sh', '-c', 'true']
  ]) assert.equal(Dispatch.enqueue(Dispatch.create(), command, 4).accepted, false)
})

test('dispatch accepts only complete closed wtype argument vectors', () => {
  const allowed = [
    ['wtype', 'a'],
    ['wtype', '-k', 'space'],
    ['wtype', '-M', 'ctrl', '-M', 'shift', 'A', '-m', 'shift', '-m', 'ctrl'],
    ['wtype', '-M', 'logo', '-k', 'Left', '-m', 'logo']
  ]
  for (const command of allowed)
    assert.equal(Dispatch.enqueue(Dispatch.create(), command, 4).accepted, true)

  const rejected = [
    ['wtype', 'multiple characters'],
    ['wtype', '-k', 'F12'],
    ['wtype', '-s', '1000', 'a'],
    ['wtype', '-M', 'ctrl', 'a'],
    ['wtype', '-M', 'ctrl', 'a', '-m', 'alt'],
    ['wtype', '-M', 'shift', '-M', 'ctrl', 'A', '-m', 'ctrl', '-m', 'shift'],
    ['wtype', '-M', 'ctrl', '-M', 'ctrl', 'a', '-m', 'ctrl', '-m', 'ctrl']
  ]
  for (const command of rejected)
    assert.equal(Dispatch.enqueue(Dispatch.create(), command, 4).accepted, false)
})

test('backend failure and cancellation discard pending actions and held UI state', () => {
  let state = Dispatch.enqueue(Dispatch.create(), ['wtype', '-M', 'ctrl', 'a', '-m', 'ctrl']).state
  state = Dispatch.enqueue(state, ['wtype', '-k', 'space']).state
  const failed = Dispatch.complete(state, 1)
  assert.equal(failed.start, null)
  assert.deepEqual(failed.state, { active: null, pending: [], status: 'backend-error' })
  assert.deepEqual(Dispatch.cancel(failed.state), Dispatch.create())
  const modifiers = Layout.activate(Layout.createState(), { id: 'ctrl', kind: 'modifier' }).state
  assert.deepEqual(Layout.cancel(modifiers), Layout.createState())
})

process.on('exit', () => {
  if (!process.exitCode) process.stdout.write('ok - all on-screen keyboard model contracts passed\n')
})
