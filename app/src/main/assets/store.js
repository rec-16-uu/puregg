/* 紫色的蛋 · 数据层 + 时间工具 */
(function (global) {
  'use strict'
  var KEY = 'purpleegg.events.v1'
  var bridge = global.ZC || null

  function pad2(n) { return (n < 10 ? '0' : '') + n }

  function dateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) }

  function fmt(d) { return dateStr(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) }

  function parse(s) {
    if (!s) return null
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
    if (!m) return null
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0)
    return isNaN(d.getTime()) ? null : d
  }

  function hhmm(s) {
    var d = parse(s)
    return d ? pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : ''
  }

  function minsOf(d) { return d.getHours() * 60 + d.getMinutes() }

  function span(ms) {
    var m = Math.floor(ms / 60000)
    if (m < 0) m = 0
    var d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60
    if (d > 0) return d + '天' + (h > 0 ? h + '小时' : '')
    if (h > 0) return h + '小时' + (mm > 0 ? mm + '分' : '')
    return Math.max(1, mm) + '分钟'
  }

  function dur(min) {
    var h = Math.floor(min / 60), m = min % 60
    if (h > 0) return h + '小时' + (m > 0 ? m + ' 分' : '')
    return m + '分钟'
  }

  function weekday(d) { return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()] }

  function uid() { return 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

  var PALETTE = ['#A97BFF', '#FF9ED2', '#8FB8FF', '#7ED9D2', '#FFD48A', '#FFA98A']

  function colorOf(e) {
    if (e.color && e.color !== 'auto') return e.color
    var s = String(e.id || ''), h = 0
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff
    return PALETTE[h % PALETTE.length]
  }

  function rgba(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
  }

  function readRaw() {
    var raw = null
    if (bridge && typeof bridge.loadData === 'function') {
      try { raw = bridge.loadData() } catch (e) { raw = null }
    }
    if (!raw) { try { raw = global.localStorage.getItem(KEY) } catch (e) { raw = null } }
    return raw
  }

  function writeRaw(text) {
    var ok = false
    if (bridge && typeof bridge.saveData === 'function') {
      try { bridge.saveData(text); ok = true } catch (e) { ok = false }
    }
    try { global.localStorage.setItem(KEY, text); ok = true } catch (e) { }
    return ok
  }

  function load() {
    var raw = readRaw(), list = []
    if (raw) { try { list = JSON.parse(raw) } catch (e) { list = [] } }
    if (!list || list.length === undefined) list = []
    for (var i = 0; i < list.length; i++) {
      var e = list[i]
      if (!e.id) e.id = uid()
      if (!e.status) e.status = 'todo'
      if (e.color === undefined) e.color = 'auto'
    }
    return list
  }

  function save(list) { return writeRaw(JSON.stringify(list)) }

  global.ZStore = { load: load, save: save, readRaw: readRaw, writeRaw: writeRaw }
  global.ZUtil = {
    pad2: pad2, dateStr: dateStr, fmt: fmt, parse: parse, hhmm: hhmm, minsOf: minsOf,
    span: span, dur: dur, weekday: weekday, uid: uid, colorOf: colorOf, rgba: rgba, PALETTE: PALETTE,
    todayStr: function () { return dateStr(new Date()) }
  }
})(window)
