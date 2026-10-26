/* 紫色的蛋 · 界面逻辑 */
(function () {
  'use strict'
  var U = window.ZUtil, K = window.ZStore

  var HOUR = 56                 /* 每小时固定高度 → 时间轴上下一律均匀 */
  var GUTTER = 54
  var DAY_MIN = 1440

  /* 时间轴只铺 08:00–22:00，每两小时一条刻度；落在这段之外的（22:00–次日 08:00）
     不在轴上了，和「没填具体起止时间」的任务一样收进左下角圆点清单。 */
  var TL_START = 8 * 60
  var TL_END = 22 * 60
  var TL_STEP = 120

  var S = { date: U.todayStr(), events: [], editingId: null, detailId: null, formColor: 'auto', formStar: false, scrolled: false }

  /* ---------------- 基础工具 ---------------- */
  function $(id) { return document.getElementById(id) }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n }
  function on(n, ev, fn) { if (n) n.addEventListener(ev, fn, false) }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild) }

  var toastTimer = null
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { t.hidden = true }, 1900)
  }

  /* 弹层是叠着开的：新开一层时把「当前这一层」记成上一级，closeTop() 就往回退一层。
     这样表单里选时间 / 日期 / 提醒、或者从「接下来」点进任务详情，退回时都回到原来的地方。 */
  var PICKER_SHEETS = ['sheetTime', 'sheetDate', 'sheetRemind']
  var sheetBack = null
  var currentSheet = null

  function isPickerSheet(id) { return PICKER_SHEETS.indexOf(id) >= 0 }

  function openSheet(id) {
    var prev = currentSheet
    var sheets = document.querySelectorAll('.sheet')
    for (var i = 0; i < sheets.length; i++) { sheets[i].classList.remove('show'); sheets[i].hidden = true }
    currentSheet = id
    sheetBack = (prev && prev !== id) ? prev : null
    $('mask').hidden = false
    setTimeout(function () { $('mask').classList.add('show') }, 0)
    var s = $(id); s.hidden = false
    setTimeout(function () { s.classList.add('show') }, 0)
  }
  function closeSheets() {
    sheetBack = null
    currentSheet = null
    var sheets = document.querySelectorAll('.sheet')
    for (var i = 0; i < sheets.length; i++) sheets[i].classList.remove('show')
    $('mask').classList.remove('show')
    setTimeout(function () {
      for (var j = 0; j < sheets.length; j++) if (!sheets[j].classList.contains('show')) sheets[j].hidden = true
      $('mask').hidden = true
    }, 200)
  }
  /* 关掉当前这一级：有上一级就回上一级，否则整体收起 */
  function closeTop() {
    var back = sheetBack
    sheetBack = null
    if (back) { currentSheet = null; openSheet(back); return }   /* 回退不算「又叠了一层」 */
    closeSheets()
  }

  /* 动态小弹层：确认 / 输入 */
  function openConfirm(title, text, okLabel, onOk) {
    var wrap = el('section', 'sheet show')
    wrap.style.zIndex = 40
    wrap.innerHTML = '<div class="sh-head"><span>' + title + '</span><button class="x" data-c>×</button></div>'
      + '<div class="sh-body"><p class="hint" style="font-size:13px;color:#4B3D60;line-height:1.7">' + text + '</p></div>'
      + '<div class="sh-foot"><button class="btn primary" data-ok>' + okLabel + '</button><button class="btn" data-c>取消</button></div>'
    document.body.appendChild(wrap)
    $('mask').hidden = false; $('mask').classList.add('show')
    function done(fire) { if (fire) onOk(); wrap.classList.remove('show'); setTimeout(function () { wrap.remove() }, 200); $('mask').classList.remove('show'); setTimeout(function () { $('mask').hidden = true }, 200) }
    wrap.addEventListener('click', function (e) {
      var t = e.target
      if (t.hasAttribute('data-ok')) done(true)
      else if (t.hasAttribute('data-c')) done(false)
    })
  }

  function openTextPrompt(title, placeholder, initial, onOk) {
    var wrap = el('section', 'sheet show')
    wrap.style.zIndex = 40
    wrap.innerHTML = '<div class="sh-head"><span>' + title + '</span><button class="x" data-c>×</button></div>'
      + '<div class="sh-body"><textarea style="width:100%;height:150px;padding:10px;border-radius:12px;border:1px solid rgba(169,123,255,.25);background:#FBF8FF;font-size:12px" placeholder="' + placeholder + '"></textarea></div>'
      + '<div class="sh-foot"><button class="btn primary" data-ok>确定</button><button class="btn" data-c>取消</button></div>'
    document.body.appendChild(wrap)
    var ta = wrap.querySelector('textarea'); ta.value = initial || ''
    $('mask').hidden = false; $('mask').classList.add('show')
    function done(fire) { if (fire) onOk(ta.value); wrap.classList.remove('show'); setTimeout(function () { wrap.remove() }, 200); $('mask').classList.remove('show'); setTimeout(function () { $('mask').hidden = true }, 200) }
    wrap.addEventListener('click', function (e) {
      var t = e.target
      if (t.hasAttribute('data-ok')) done(true)
      else if (t.hasAttribute('data-c')) done(false)
    })
  }

  /* ---------------- 时间槽计算 ---------------- */
  function minsOfDate(s) { var d = U.parse(s); return d ? U.minsOf(d) : null }

  function slotOf(e, dateStr) {
    var s = U.parse(e.startAt), en = U.parse(e.endAt)
    var sd = s ? U.dateStr(s) : null, ed = en ? U.dateStr(en) : null
    if (sd === dateStr && ed === dateStr && en.getTime() > s.getTime()) return { kind: 'block', s: U.minsOf(s), en: U.minsOf(en) }
    if (sd === dateStr && ed && ed !== dateStr && en.getTime() > s.getTime()) return { kind: 'block', s: U.minsOf(s), en: DAY_MIN, cross: true }
    if (sd && sd !== dateStr && ed === dateStr) return { kind: 'block', s: 0, en: U.minsOf(en), crossFrom: true }
    if (sd === dateStr) return { kind: 'point', at: U.minsOf(s), tag: ed ? '开始' : '开始' }
    if (ed === dateStr) return { kind: 'point', at: U.minsOf(en), tag: '截止' }
    return null
  }

  function pickDate(e, dateStr) {
    var s = U.parse(e.startAt), en = U.parse(e.endAt)
    if (s && U.dateStr(s) === dateStr) return s
    if (en && U.dateStr(en) === dateStr) return en
    return null
  }

  function targetTime(e) {
    var s = U.parse(e.startAt); if (s) return s
    return U.parse(e.endAt)
  }

  function hm(min) { return U.pad2(Math.floor(min / 60)) + ':' + U.pad2(min % 60) }

  /* 这一刻/这一段有没有碰到 22:00–08:00 */
  function touchesNight(sl) {
    if (!sl) return false
    if (sl.kind === 'block') return sl.s < TL_START || sl.en > TL_END
    return sl.at < TL_START || sl.at >= TL_END
  }

  /* 这一刻/这一段在 08:00–22:00 里有没有可见部分 */
  function visibleOnAxis(sl) {
    if (!sl) return false
    if (sl.kind === 'block') return sl.s < TL_END && sl.en > TL_START
    return sl.at >= TL_START && sl.at < TL_END
  }

  /* 把 [s,en] 裁到 08:00–22:00，返回 {s,en} 或 null */
  function clipToAxis(s, en) {
    var a = Math.max(s, TL_START), b = Math.min(en, TL_END)
    if (b - a < 1) return null
    return { s: a, en: b }
  }

  function yOf(min) { return (Math.max(TL_START, Math.min(TL_END, min)) - TL_START) / 60 * HOUR }

  function fmtDate(ds) {
    var d = U.parse(ds + 'T00:00')
    if (!d) return ds
    return (d.getMonth() + 1) + '月' + d.getDate() + '日'
  }

  /* 选中日期的人话标题：9月24日 周四 · 今天 */
  function dayTitleText(ds) {
    var d = U.parse(ds + 'T00:00')
    if (!d) return ds
    var today = U.todayStr()
    var suffix
    if (ds === today) suffix = ' · 今天'
    else {
      var t = U.parse(today + 'T00:00')
      var diff = Math.round((d.getTime() - t.getTime()) / 86400000)
      suffix = diff === 1 ? ' · 明天' : diff === -1 ? ' · 昨天'
        : diff > 1 ? ' · ' + diff + ' 天后' : ' · ' + (-diff) + ' 天前'
    }
    return fmtDate(ds) + ' 周' + U.weekday(d) + suffix
  }

  /* ---------------- 渲染：日期条 ---------------- */
  /* 日期条下面每颗小圆点 = 那天还没完成的一件事（勾掉后就少一颗，所以点数 = 那天还剩几件事）。
     日期格子只有 44px 宽，按「几个点画几个」来：
       ≤7 个 → 4px 点；≤11 个 → 3px 点；再多就直接写数字（比如 13），
     绝不再像以前那样截断到 3 个（那样一天明明 4 件事却只画 3 颗）。 */
  function dotsFor(ds) {
    var n = 0
    for (var i = 0; i < S.events.length; i++) {
      var e = S.events[i]
      if (e.status !== 'todo') continue
      if (pickDate(e, ds)) n++
    }
    return dotHtml(n)
  }

  function dotHtml(n) {
    if (!n) return ''
    if (n > 11) return '<em class="n">' + n + '</em>'
    var cls = n > 7 ? ' class="s"' : ''
    var s = ''
    for (var i = 0; i < n; i++) s += '<i' + cls + '></i>'
    return s
  }

  function renderStrip() {
    var strip = $('strip'); clear(strip)
    var base = new Date(); base.setHours(0, 0, 0, 0)
    var dow = (base.getDay() + 6) % 7
    var start = new Date(base); start.setDate(base.getDate() - dow - 21)   /* 从 3 周前开始，跨月/跨年都能看到 */
    var prevM = -1, prevY = -1
    for (var i = 0; i < 70; i++) {
      var d = new Date(start); d.setDate(start.getDate() + i)
      var ds = U.dateStr(d)
      var y = d.getFullYear(), mo = d.getMonth()
      /* 月份 / 年份分界处，单独插一个标注 */
      if (mo !== prevM || y !== prevY) {
        var label = (prevY === -1 || y !== prevY) ? (y + '年' + (mo + 1) + '月') : ((mo + 1) + '月')
        var div = el('div', 'mdiv' + (prevY !== -1 && y !== prevY ? ' year' : ''), label)
        strip.appendChild(div)
        prevM = mo; prevY = y
      }
      var node = el('button', 'day' + (ds === S.date ? ' on' : ''))
      node.innerHTML = '<span>' + U.weekday(d) + '</span><b>' + d.getDate() + '</b><span class="dotm">' + dotsFor(ds) + '</span>'
      node.setAttribute('data-d', ds)
      strip.appendChild(node)
    }
    var on = strip.querySelector('.day.on')
    if (on) strip.scrollLeft = Math.max(0, on.offsetLeft - strip.clientWidth / 2 + 22)
  }

  /* ---------------- 选日期：点某一天 / 前一天 / 后一天 / 回到今天 ---------------- */
  function renderDayTitle() {
    var n = $('dayTitle')
    if (n) n.textContent = dayTitleText(S.date)
  }

  function setDate(ds) {
    if (!ds) return
    if (ds !== S.date) {
      S.date = ds
      S.scrolled = false            /* 换天要重新滚到那一天的第一件事 */
    }
    renderAll()
  }

  function shiftDate(delta) {
    var d = U.parse(S.date + 'T00:00')
    if (!d) d = new Date()
    d.setDate(d.getDate() + delta)
    setDate(U.dateStr(d))
  }

  function closestDay(node) {
    while (node && node !== document) {
      if (node.className && String(node.className).split(/\s+/).indexOf('day') >= 0) return node
      node = node.parentNode
    }
    return null
  }

  /* ---------------- 渲染：08:00–22:00 时间轴（两小时一条刻度） ---------------- */
  function renderTimeline() {
    var canvas = $('tlCanvas'); clear(canvas)
    document.documentElement.style.setProperty('--hour', HOUR + 'px')
    document.documentElement.style.setProperty('--gutter', GUTTER + 'px')

    for (var m = TL_START; m <= TL_END; m += TL_STEP) {
      var y = yOf(m)
      var line = el('div', 'hr' + (m === TL_START || m === TL_END ? ' edge' : ''))
      line.style.top = y + 'px'
      canvas.appendChild(line)
      var lab = el('div', 'hl', U.pad2(m / 60) + ':00')
      lab.style.top = y + 'px'
      canvas.appendChild(lab)
    }
    canvas.style.height = (yOf(TL_END) + 26) + 'px'

    /* 分组：块 / 点（只取在这段里看得见的） */
    var blocks = [], points = [], nightN = 0
    for (var i = 0; i < S.events.length; i++) {
      var e = S.events[i]
      var sl = slotOf(e, S.date)
      if (!sl) continue
      if (touchesNight(sl)) nightN++
      if (!visibleOnAxis(sl)) continue
      sl.e = e
      if (sl.kind === 'block') blocks.push(sl)
      else points.push(sl)
    }

    /* 重叠分道：保留整宽 + 逐层右移，文字胶囊错开，保证不压字 */
    blocks.sort(function (a, b) { return a.s - b.s || a.en - b.en })
    var laneEnd = []
    for (var b = 0; b < blocks.length; b++) {
      var it = blocks[b], lane = 0
      while (lane < laneEnd.length && laneEnd[lane] > it.s) lane++
      laneEnd[lane] = it.en
      it.lane = lane
    }

    for (var c = 0; c < blocks.length; c++) {
      var bl = blocks[c], ev = bl.e
      var clipped = clipToAxis(bl.s, bl.en)
      if (!clipped) continue
      var node = el('div', 'ev' + (ev.status === 'done' ? ' done' : ''))
      var top = yOf(clipped.s)
      var hgt = Math.max(24, (clipped.en - clipped.s) / 60 * HOUR)
      var off = Math.min(bl.lane, 3) * 8
      node.style.top = top + 'px'
      node.style.height = hgt + 'px'
      node.style.left = (GUTTER + off) + 'px'
      node.style.right = '10px'
      node.style.setProperty('--c', U.colorOf(ev))
      node.style.setProperty('--cbg', U.rgba(U.colorOf(ev), 0.22))
      var capTop = Math.min(bl.lane * 20, Math.max(0, hgt - 26))
      var cap = el('div', 'cap')
      cap.style.marginTop = (4 + capTop) + 'px'
      var tail = bl.cross ? '次日' : U.hhmm(ev.endAt)
      if (bl.en > TL_END) tail = U.hhmm(ev.endAt) + '（22:00 之后见左下角）'
      cap.innerHTML = esc(ev.title || '未命名') + '<small>' + U.hhmm(ev.startAt) + '–' + tail + ' · ' + U.dur(clipped.en - clipped.s) + '</small>'
      node.appendChild(cap)
      if (bl.cross) node.appendChild(el('div', 'lnk', '↦ 次日'))
      if (bl.crossFrom) { var lk = el('div', 'lnk', '↤ 昨日'); lk.style.right = 'auto'; lk.style.left = '6px'; node.appendChild(lk) }
      if (bl.s < TL_START) { var lk2 = el('div', 'lnk', '↤ 08:00 之前'); lk2.style.right = 'auto'; lk2.style.left = '6px'; node.appendChild(lk2) }
      bindTap(node, ev)
      canvas.appendChild(node)
    }

    /* 单点任务：彩色横线。
       同一时刻多条时：第 1 条文字在上、第 2 条文字在下、第 3 条起不再排文字，
       只在该组第 2 条上加「+N」角标；文字永不相压，完整名单看左下角图例。 */
    points.sort(function (a, b) { return a.at - b.at })
    var groups = []
    for (var p = 0; p < points.length; p++) {
      var pt = points[p]
      if (groups.length === 0 || pt.at - groups[groups.length - 1].lastAt > 18) groups.push({ items: [], lastAt: pt.at })
      var gp = groups[groups.length - 1]
      gp.lastAt = pt.at
      gp.items.push(pt)
    }
    for (var gi = 0; gi < groups.length; gi++) {
      var items = groups[gi].items
      for (var ii = 0; ii < items.length; ii++) {
        var po = items[ii], pe = po.e
        var line = el('div', 'pt' + (pe.status === 'done' ? ' done' : ''))
        line.style.top = (yOf(po.at) + Math.min(ii, 2) * 7) + 'px'
        line.style.setProperty('--c', U.colorOf(pe))
        if (ii === 0 || ii === 1) {
          var pc = el('div', 'cap' + (ii === 1 ? ' below' : ''))
          pc.style.top = ii === 1 ? '5px' : '-20px'
          pc.innerHTML = esc(pe.title || '未命名') + '<small>' + U.hhmm(pe.startAt || pe.endAt) + ' · ' + po.tag + '</small>'
          line.appendChild(pc)
        } else if (ii === 2) {
          var mb = el('div', 'cap more', '+' + (items.length - 2))
          mb.style.top = '5px'
          line.appendChild(mb)
        }
        bindTap(line, pe)
        canvas.appendChild(line)
      }
    }

    /* 当前时间线（只有今天、且现在落在 08:00–22:00 之间才画） */
    var now = new Date()
    var isToday = U.dateStr(now) === S.date
    var nowMin = U.minsOf(now)
    if (isToday && nowMin >= TL_START && nowMin <= TL_END) {
      var nl = el('div', 'nowline')
      nl.style.top = yOf(nowMin) + 'px'
      canvas.appendChild(nl)
    }

    /* 这一天的 08:00–22:00 里什么都没有 */
    if (blocks.length === 0 && points.length === 0) {
      var hint = el('div', 'tl-empty')
      hint.style.top = (yOf(TL_START) + 150) + 'px'
      hint.innerHTML = '这一天 08:00–22:00 没有安排'
        + (nightN > 0 ? '<br><span>（' + nightN + ' 件事在 22:00 之后 / 08:00 之前，看左下角）</span>' : '')
      canvas.appendChild(hint)
    }

    if (!S.scrolled) {
      var targetMin = null
      if (isToday) targetMin = nowMin - 90
      else if (blocks.length) targetMin = blocks[0].s - 60
      else if (points.length) targetMin = points[0].at - 60
      if (targetMin !== null) {
        S.scrolled = true
        var sc = $('tlScroll')
        var target = Math.max(0, yOf(targetMin))
        var go = function () { sc.scrollTop = target }
        go()
        // 首次渲染时画布高度可能还没布局完成，滚动会被钳位；布局完再滚一次
        if (window.requestAnimationFrame) requestAnimationFrame(function () { requestAnimationFrame(go) })
        else setTimeout(go, 60)
      }
    }
  }

  function bindTap(node, ev) {
    var timer = null, moved = false
    on(node, 'touchstart', function () { moved = false; timer = setTimeout(function () { timer = null; toggleDone(ev) }, 550) })
    on(node, 'touchmove', function () { moved = true; if (timer) { clearTimeout(timer); timer = null } })
    on(node, 'touchend', function () {
      if (timer) { clearTimeout(timer); timer = null; if (!moved) openDetail(ev.id) }
    })
    on(node, 'click', function (e) {
      e.stopPropagation()
      if (!('ontouchstart' in window)) openDetail(ev.id)
    })
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }

  /* ---------------- 渲染：左下角圆点清单 ----------------
     收三种在时间轴上「画不出来」的东西：
       1. 单点任务（只填了开始 或 只填了结束）→ 轴上一条彩色横线 + 这里一行
       2. 22:00–08:00 里的事（轴的区间之外）→ 只在这里
       3. 没填任何时间的备忘（待安排）→ 只在这里 */
  function legendItems() {
    var out = []
    for (var i = 0; i < S.events.length; i++) {
      var e = S.events[i]
      var s = U.parse(e.startAt), en = U.parse(e.endAt)
      if (!s && !en) {
        out.push({ e: e, key: 9999, tag: '待安排', time: '' })
        continue
      }
      var sl = slotOf(e, S.date)
      if (!sl) continue
      if (sl.kind === 'point') {
        var night = touchesNight(sl)
        out.push({
          e: e, key: sl.at,
          tag: night ? '夜间' : sl.tag,
          time: hm(sl.at),
          night: night
        })
      } else if (touchesNight(sl)) {
        out.push({
          e: e, key: sl.s, night: true, tag: '夜间',
          time: hm(sl.s) + '–' + (sl.cross ? '次日' : hm(sl.en))
        })
      }
    }
    out.sort(function (a, b) { return a.key - b.key })
    return out
  }

  function renderLegend() {
    var wrap = $('legend'), body = $('legendBody'); clear(body)
    var items = legendItems()
    if (items.length === 0) { wrap.hidden = true; return }
    wrap.hidden = false
    for (var j = 0; j < items.length; j++) {
      (function (it) {
        var row = el('div', 'lg-item' + (it.e.status === 'done' ? ' done' : '') + (it.night ? ' night' : ''))
        row.style.setProperty('--c', U.colorOf(it.e))
        row.innerHTML = '<i></i><span>' + esc(it.e.title || '未命名') + '</span><em>'
          + (it.time ? it.time + ' · ' : '') + it.tag + '</em>'
        on(row, 'click', function () { openDetail(it.e.id) })
        body.appendChild(row)
      })(items[j])
    }
  }

  /* ---------------- 渲染：右上角倒计时 ---------------- */
  function renderCountdown() {
    var now = new Date(), nowT = now.getTime()
    var active = null, next = null
    for (var i = 0; i < S.events.length; i++) {
      var e = S.events[i]
      if (e.status !== 'todo') continue
      var s = U.parse(e.startAt), en = U.parse(e.endAt)
      if (s && en && s.getTime() <= nowT && en.getTime() >= nowT) { active = { e: e, end: en }; continue }
      var t = targetTime(e)
      if (!t) continue
      if (t.getTime() > nowT && (!next || t.getTime() < next.t.getTime())) next = { e: e, t: t }
    }
    var node = $('countdown')
    if (active) node.textContent = '进行中 · ' + (active.e.title || '未命名') + ' · 还剩 ' + U.span(active.end.getTime() - nowT)
    else if (next) node.textContent = '距 ' + (next.e.title || '未命名') + ' 还有 ' + U.span(next.t.getTime() - nowT)
    else node.textContent = '今天没有待办'
  }

  /* ---------------- 重要事件 ----------------
     一条任务可以标记 star（重要）。右上角那颗胶囊点开就是「最近三件 + 重要事件」，
     重要事件在面板里能直接取消，任务详情里也能随手加/取消。 */
  function isStar(e) { return !!(e && (e.star === true || e.star === 1 || e.star === '1')) }

  /* 接下来 n 件（按时间，含刚过去一分钟内的） */
  function upcomingList(n) {
    var nowT = Date.now(), out = []
    for (var i = 0; i < S.events.length; i++) {
      var e = S.events[i]
      if (e.status !== 'todo') continue
      var t = targetTime(e)
      if (!t || t.getTime() + 60000 < nowT) continue
      out.push({ e: e, t: t.getTime() })
    }
    out.sort(function (a, b) { return a.t - b.t })
    return n ? out.slice(0, n) : out
  }

  /* 所有还没做完的重要事件（没填时间的排最后） */
  function starList() {
    var out = []
    for (var i = 0; i < S.events.length; i++) {
      var e = S.events[i]
      if (e.status !== 'todo' || !isStar(e)) continue
      var t = targetTime(e)
      out.push({ e: e, t: t ? t.getTime() : Infinity })
    }
    out.sort(function (a, b) { return a.t - b.t })
    return out
  }

  function setFormStar(on) {
    S.formStar = !!on
    var sw = $('btnStar'), tx = $('starText')
    if (sw) {
      sw.setAttribute('aria-checked', S.formStar ? 'true' : 'false')
      if (S.formStar) sw.classList.add('on'); else sw.classList.remove('on')
    }
    if (tx) tx.textContent = S.formStar ? '重要事件' : '普通任务'
  }

  /* 加 / 取消重要事件：详情页和面板都走这里 */
  function toggleStar(e) {
    if (!e) return
    var on = !isStar(e)
    if (on) e.star = true; else delete e.star
    persist()
    if (S.detailId === e.id) renderDetail(e)
    if (!$('sheetNow').hidden) renderNow()
    renderAll()
    toast(on ? '已加入重要事件' : '已取消重要事件')
  }

  /* 时间标签：今天 09:00 / 明天 09:00 / 10月2日 09:00 */
  function whenLabel(ts) {
    var d = new Date(ts)
    var t0 = U.parse(U.todayStr() + 'T00:00')
    var diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - t0.getTime()) / 86400000)
    var day = diff === 0 ? '今天' : diff === 1 ? '明天' : diff === 2 ? '后天'
      : (d.getMonth() + 1) + '月' + d.getDate() + '日'
    return day + ' ' + U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes())
  }

  function nowRow(item, canCancel) {
    var e = item.e
    var row = el('div', 'now-row')
    row.style.setProperty('--c', U.colorOf(e))
    row.appendChild(el('i', 'nd'))
    var txt = el('div', 'ntxt')
    txt.appendChild(el('div', 'ntt', esc(e.title || '未命名')))
    txt.appendChild(el('div', 'nsub', item.t === Infinity ? '待安排' : whenLabel(item.t)))
    row.appendChild(txt)
    if (canCancel) {
      var off = el('span', 'noff', '取消')
      on(off, 'click', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); toggleStar(e) })
      row.appendChild(off)
    } else if (isStar(e)) {
      row.appendChild(el('span', 'nstar', '★'))
    }
    on(row, 'click', function () { openDetail(e.id) })
    return row
  }

  function renderNow() {
    var next = $('nowNext'), star = $('nowStar')
    if (!next || !star) return
    clear(next); clear(star)
    var list = upcomingList(3)
    if (!list.length) next.appendChild(el('div', 'empty', '接下来没有安排'))
    else for (var i = 0; i < list.length; i++) next.appendChild(nowRow(list[i], false))
    var sl = starList()
    if (!sl.length) star.appendChild(el('div', 'empty', '还没标重要：在任务里把「重要」打开就行'))
    else for (var j = 0; j < sl.length; j++) star.appendChild(nowRow(sl[j], true))
  }

  function openNow() { renderNow(); openSheet('sheetNow') }

  /* ---------------- 渲染：待安排 / 已完成 ---------------- */
  function backlogList() {
    var out = []
    for (var i = 0; i < S.events.length; i++) {
      var e = S.events[i]
      if (e.status !== 'todo') continue
      if (!U.parse(e.startAt) && !U.parse(e.endAt)) out.push(e)
    }
    return out
  }

  function renderBadges() {
    var n = backlogList().length
    $('backlogN').textContent = n
  }

  function renderBacklog() {
    var body = $('bkBody'); clear(body)
    var list = S.events.filter(function (e) { return e.status === 'todo' && !U.parse(e.startAt) && !U.parse(e.endAt) })
    if (list.length === 0) { body.appendChild(el('div', 'empty', '没有待安排的事')); return }
    for (var i = 0; i < list.length; i++) body.appendChild(cardNode(list[i], '未安排时间'))
  }

  function renderDone() {
    var body = $('dnBody'); clear(body)
    var list = S.events.filter(function (e) { return e.status === 'done' })
    list.sort(function (a, b) { return String(b.completedAt || '').localeCompare(String(a.completedAt || '')) })
    if (list.length === 0) { body.appendChild(el('div', 'empty', '还没有完成的任务')); return }
    for (var i = 0; i < list.length; i++) body.appendChild(cardNode(list[i], '完成于 ' + (U.parse(list[i].completedAt) ? U.hhmm(list[i].completedAt) + '（' + String(list[i].completedAt).slice(5, 10).replace('-', '/') + '）' : '—')))
  }

  function cardNode(e, sub) {
    var c = el('div', 'card' + (e.status === 'done' ? ' done' : ''))
    c.style.setProperty('--c', U.colorOf(e))
    var t = ''
    if (e.note) t += '<br>' + esc(e.note)
    c.innerHTML = '<i class="dot"></i><div class="txt"><div class="tt">' + esc(e.title || '未命名') + '</div><div class="sub">' + sub + t + '</div></div>'
    var ok = el('button', 'ok', e.status === 'done' ? '恢复' : '完成')
    on(ok, 'click', function (ev) { ev.stopPropagation(); toggleDone(e) })
    c.appendChild(ok)
    on(c, 'click', function () { openDetail(e.id) })
    return c
  }

  /* ---------------- 详情 ---------------- */
  function renderDetail(e) {
    $('dtTitle').textContent = e.title || '未命名'
    var body = $('dtBody'); clear(body)
    var sl = slotOf(e, S.date)
    var kind = !U.parse(e.startAt) && !U.parse(e.endAt) ? '待安排'
      : !sl ? '这天没有它的安排'
        : (sl.kind === 'point' && touchesNight(sl)) ? '22:00–08:00 内 · 标在左下角圆点清单'
          : (sl.kind === 'block' && touchesNight(sl)) ? '有开始 + 结束 · 时间轴上画方块，22:00–08:00 那段在左下角'
            : (sl.kind === 'point') ? '单点时间 · 时间轴上显示为彩色横线'
              : '有开始 + 结束 · 时间轴上显示为彩色方块'
    body.appendChild(el('div', 'dt-badge', kind))
    var starBtn = el('button', 'pillbtn' + (isStar(e) ? ' on' : ''), isStar(e) ? '★ 重要事件 · 点一下取消' : '☆ 加入重要事件')
    on(starBtn, 'click', function () { toggleStar(e) })
    body.appendChild(starBtn)
    var rows = []
    if (e.startAt) rows.push(['开始', U.hhmm(e.startAt) + '　' + String(e.startAt).slice(5, 10).replace('-', '/')])
    if (e.endAt) rows.push(['结束', U.hhmm(e.endAt) + '　' + String(e.endAt).slice(5, 10).replace('-', '/')])
    if (e.note) rows.push(['备注', esc(e.note)])
    if (e.remind !== null && e.remind !== undefined && e.remind !== '') rows.push(['提醒', remindLabel(e.remind)])
    if (e.status === 'done') rows.push(['状态', '已完成'])
    if (rows.length === 0) body.appendChild(el('div', 'empty', '没有更多信息'))
    for (var i = 0; i < rows.length; i++) body.appendChild(el('div', 'dt-line', '<span>' + rows[i][0] + '</span><div>' + rows[i][1] + '</div>'))
    $('btnComplete').textContent = e.status === 'done' ? '↺ 恢复未完成' : '✓ 完成'
  }

  function openDetail(id) {
    var e = find(id); if (!e) return
    S.detailId = id
    renderDetail(e)
    openSheet('sheetDetail')
  }

  function find(id) {
    for (var i = 0; i < S.events.length; i++) if (S.events[i].id === id) return S.events[i]
    return null
  }

  /* ---------------- 添加 / 编辑 ---------------- */
  function setFormColor(c) {
    S.formColor = c
    var sw = $('swatches').children
    for (var i = 0; i < sw.length; i++) {
      var v = sw[i].getAttribute('data-c')
      sw[i].className = 'sw' + (v === c ? ' on' : '')
      sw[i].style.background = v === 'auto' ? 'linear-gradient(135deg,#A97BFF,#FF9ED2)' : v
    }
  }

  function buildSwatches() {
    var box = $('swatches'); clear(box)
    var opts = ['auto'].concat(U.PALETTE)
    for (var i = 0; i < opts.length; i++) {
      (function (c) {
        var b = el('button', 'sw')
        b.setAttribute('data-c', c)
        if (c !== 'auto') b.style.background = c
        b.onclick = function () { setFormColor(c) }
        box.appendChild(b)
      })(opts[i])
    }
  }

  function openAdd(atMin) {
    S.editingId = null
    S.formColor = 'auto'
    $('editTitle').textContent = '新任务'
    $('fTitle').value = ''
    $('fNote').value = ''
    var base = new Date(); base.setHours(0, 0, 0, 0)
    if (S.date !== U.todayStr()) {
      var parts = S.date.split('-')
      base = new Date(+parts[0], +parts[1] - 1, +parts[2])
    }
    var now = new Date()
    var h = now.getHours(), m = Math.ceil(now.getMinutes() / 5) * 5
    if (m >= 60) { m = 0; h = (h + 1) % 24 }
    $('fStartDate').value = U.dateStr(base)
    $('fStartTime').value = atMin != null ? U.pad2(Math.floor(atMin / 60)) + ':' + U.pad2(atMin % 60) : U.pad2(h) + ':' + U.pad2(m)
    $('fEndDate').value = ''; $('fEndTime').value = ''
    setRemind('0')
    buildSwatches(); setFormColor('auto')
    setFormStar(false)
    updateHint()
    openSheet('sheetEdit')   /* 不自动聚焦标题：免得刚点 ＋ 就弹出键盘挡住表单 */
  }

  function openEdit(id) {
    var e = find(id); if (!e) return
    S.editingId = id
    $('editTitle').textContent = '编辑任务'
    $('fTitle').value = e.title || ''
    $('fNote').value = e.note || ''
    $('fStartDate').value = e.startAt ? String(e.startAt).slice(0, 10) : ''
    $('fStartTime').value = e.startAt ? String(e.startAt).slice(11, 16) : ''
    $('fEndDate').value = e.endAt ? String(e.endAt).slice(0, 10) : ''
    $('fEndTime').value = e.endAt ? String(e.endAt).slice(11, 16) : ''
    setRemind((e.remind === null || e.remind === undefined) ? '' : String(e.remind))
    buildSwatches(); setFormColor(e.color || 'auto')
    setFormStar(isStar(e))
    updateHint()
    openSheet('sheetEdit')
  }

  function compose(dateVal, timeVal) {
    if (!timeVal) return null
    var d = dateVal || S.date
    return d + 'T' + timeVal
  }

  function updateHint() {
    var s = compose($('fStartDate').value, $('fStartTime').value)
    var en = compose($('fEndDate').value, $('fEndTime').value)
    var night = false
    if (s) { var sm = minsOfDate(s); if (sm !== null && (sm < TL_START || sm >= TL_END)) night = true }
    if (en) { var em = minsOfDate(en); if (em !== null && (em <= TL_START || em > TL_END)) night = true }
    var txt
    if (s && en) txt = '方块，高度就是时长。'
    else if (s) txt = '一条横线，同时进左下角清单。'
    else if (en) txt = '截止：一条横线，同时进左下角清单。'
    else txt = '当备忘放着，在「待安排」里。'
    if (night && (s || en)) txt += ' 落在 22:00–08:00，只在左下角清单里。'
    $('timeHint').textContent = txt
  }

  function saveForm() {
    var title = $('fTitle').value.trim()
    if (!title) { toast('给任务起个名字'); $('fTitle').focus(); return }
    var s = compose($('fStartDate').value, $('fStartTime').value)
    var en = compose($('fEndDate').value, $('fEndTime').value)
    if (s && en) {
      var sd = U.parse(s), ed = U.parse(en)
      if (sd && ed && ed.getTime() <= sd.getTime()) {
        var fix = new Date(sd.getTime() + 60 * 60000)
        en = U.fmt(fix)
        $('fEndDate').value = String(en).slice(0, 10)
        $('fEndTime').value = String(en).slice(11, 16)
        toast('结束时间早于开始，已改为 1 小时后')
      }
    }
    var remind = $('fRemind').value
    var data = {
      title: title,
      note: $('fNote').value.trim(),
      startAt: s || null,
      endAt: en || null,
      remind: remind === '' ? null : Number(remind),
      color: S.formColor || 'auto',
      star: !!S.formStar
    }
    if (!S.formStar) data.star = false
    if (S.editingId) {
      var e = find(S.editingId)
      for (var k in data) if (data.hasOwnProperty(k)) e[k] = data[k]
    } else {
      data.id = U.uid(); data.status = 'todo'; data.createdAt = U.fmt(new Date()); data.completedAt = null
      S.events.push(data)
    }
    persist()
    closeSheets()
    if (s || en) {
      var sl = slotOf(data, S.date)
      toast(sl && touchesNight(sl) ? '已保存 · 22:00–08:00，标在左下角' : (S.editingId ? '已保存' : '已添加'))
    } else {
      toast(S.editingId ? '已保存' : '已添加 · 待安排')
    }
    if (data.remind !== null && window.ZC && ZC.requestNotificationPermission) { try { ZC.requestNotificationPermission() } catch (err) { } }
    renderAll()
  }

  function toggleDone(e) {
    if (!e) return
    e.status = e.status === 'done' ? 'todo' : 'done'
    e.completedAt = e.status === 'done' ? U.fmt(new Date()) : null
    persist()
    toast(e.status === 'done' ? '已完成 ✓' : '已恢复')
    renderAll()
  }

  function removeEvent(id) {
    for (var i = 0; i < S.events.length; i++) if (S.events[i].id === id) { S.events.splice(i, 1); break }
    persist(); renderAll()
  }

  /* ---------------- 持久化 + 提醒 ---------------- */
  function persist() {
    K.save(S.events)
    syncReminders()
  }

  function syncReminders() {
    if (!window.ZC || typeof ZC.syncReminders !== 'function') return
    var now = Date.now(), out = []
    for (var i = 0; i < S.events.length; i++) {
      var e = S.events[i]
      if (e.status !== 'todo') continue
      if (e.remind === null || e.remind === undefined || e.remind === '') continue
      var base = targetTime(e)
      if (!base) continue
      var at = base.getTime() - (Number(e.remind) || 0) * 60000
      if (at <= now) continue
      out.push({ id: e.id, at: at, title: e.title || '未命名', text: U.hhmm(e.startAt || e.endAt) })
    }
    try { ZC.syncReminders(JSON.stringify(out)) } catch (err) { }
  }

  /* 提醒时刻 = 任务时刻往前推 remind 分钟（1 天 = 1440、3 天 = 4320，都只是分钟数） */
  function remindAt(startAt, remind) {
    var d = U.parse(startAt)
    if (!d) return null
    return U.fmt(new Date(d.getTime() - (Number(remind) || 0) * 60000))
  }

  /* ---------------- 总渲染 ---------------- */
  function renderAll() {
    renderDayTitle(); renderStrip(); renderTimeline(); renderLegend(); renderCountdown(); renderBadges()
    if (!$('sheetBacklog').hidden) renderBacklog()
    if (!$('sheetDone').hidden) renderDone()
  }

  /* ---------------- 提醒：自己的选择弹层 ----------------
     手机自带的下拉是个白底单选框列表，跟主题不搭。这里换成一行行可点的选项：
     选中那行有浅紫底 + 勾，点一下即生效（提醒本来就是「选一个」的动作）。 */
  var REMIND_OPTS = [
    { v: '', label: '不提醒' },
    { v: '0', label: '到点提醒' },
    { v: '5', label: '提前 5 分钟' },
    { v: '15', label: '提前 15 分钟' },
    { v: '30', label: '提前 30 分钟' },
    { v: '60', label: '提前 1 小时' },
    { v: '360', label: '提前 6 小时' },
    { v: '1440', label: '提前 1 天' },
    { v: '4320', label: '提前 3 天' }
  ]

  /* 存的值一律是「提前多少分钟」，显示时挑最顺口的单位；
     不在选项表里的旧值（比如以前存的 120）也能正常显示成「提前 2 小时」。 */
  function remindLabel(v) {
    v = (v === null || v === undefined) ? '' : String(v)
    for (var i = 0; i < REMIND_OPTS.length; i++) if (REMIND_OPTS[i].v === v) return REMIND_OPTS[i].label
    if (v === '') return '不提醒'
    var n = Number(v)
    if (!isFinite(n) || n < 0) return '不提醒'
    if (n === 0) return '到点提醒'
    if (n % 1440 === 0) return '提前 ' + (n / 1440) + ' 天'
    if (n % 60 === 0) return '提前 ' + (n / 60) + ' 小时'
    return '提前 ' + n + ' 分钟'
  }

  function setRemind(v) {
    v = (v === null || v === undefined) ? '' : String(v)
    var hid = $('fRemind'); if (hid) hid.value = v
    var txt = $('remindText'); if (txt) txt.textContent = remindLabel(v)
    var prev = $('rpPrev'); if (prev) prev.textContent = remindLabel(v)
    var box = $('remindOpts')
    if (!box) return
    for (var i = 0; i < box.children.length; i++) {
      var row = box.children[i]
      if (row.getAttribute('data-v') === v) row.classList.add('on')
      else row.classList.remove('on')
    }
  }

  /* ---------- 自定义提醒：数字 + 单位（分钟 / 小时 / 天） ---------- */
  var RM_UNITS = [{ k: 'm', label: '分钟' }, { k: 'h', label: '小时' }, { k: 'd', label: '天' }]
  var RM_UNIT = { m: 1, h: 60, d: 1440 }

  function buildUnits() {
    var u = $('rmUnit')
    if (!u || u.children.length) return
    for (var i = 0; i < RM_UNITS.length; i++) {
      (function (o) {
        var b = el('button', o.k === 'm' ? 'on' : '', o.label)
        b.setAttribute('data-u', o.k)
        on(b, 'click', function () { rmSetUnit(o.k) })
        u.appendChild(b)
      })(RM_UNITS[i])
    }
  }

  function rmUnitKey() {
    var u = $('rmUnit')
    if (!u) return 'm'
    for (var i = 0; i < u.children.length; i++) {
      if (u.children[i].classList.contains('on')) return u.children[i].getAttribute('data-u') || 'm'
    }
    return 'm'
  }

  function rmSetUnit(k) {
    var u = $('rmUnit')
    if (!u) return
    for (var i = 0; i < u.children.length; i++) {
      var b = u.children[i]
      if (b.getAttribute('data-u') === k) b.classList.add('on')
      else b.classList.remove('on')
    }
  }

  function rmNumVal() {
    var n = parseInt($('rmNum') ? $('rmNum').value : '', 10)
    if (!isFinite(n) || n < 1) n = 1
    if (n > 999) n = 999
    return n
  }

  function rmStep(d) {
    var n = rmNumVal() + d
    if (n < 1) n = 1
    if (n > 999) n = 999
    var box = $('rmNum'); if (box) box.value = String(n)
  }

  /* 把「提前多少分钟」拆成最顺口的单位和数字，填进自定义那一行 */
  function fillCustom(minutes) {
    var n = Number(minutes)
    if (!isFinite(n) || n <= 0) { if ($('rmNum')) $('rmNum').value = '30'; rmSetUnit('m'); return }
    if (n % 1440 === 0 && n / 1440 <= 999) { if ($('rmNum')) $('rmNum').value = String(n / 1440); rmSetUnit('d'); return }
    if (n % 60 === 0 && n / 60 <= 999) { if ($('rmNum')) $('rmNum').value = String(n / 60); rmSetUnit('h'); return }
    if ($('rmNum')) $('rmNum').value = String(Math.min(999, Math.round(n)))
    rmSetUnit('m')
  }

  /* 自定义生效：分钟数上限 30 天 */
  function rmApply() {
    var mins = rmNumVal() * (RM_UNIT[rmUnitKey()] || 1)
    if (mins > 43200) mins = 43200
    setRemind(String(mins))
    closeTop()
    updateHint()
  }

  function buildRemind() {
    var box = $('remindOpts')
    if (!box || box.children.length) return
    for (var i = 0; i < REMIND_OPTS.length; i++) {
      (function (opt) {
        var row = el('button', 'opt')
        row.appendChild(el('b', '', opt.label))
        row.appendChild(el('i', 'tick', '✓'))
        row.setAttribute('data-v', opt.v)
        on(row, 'click', function () { setRemind(opt.v); closeTop(); updateHint() })
        box.appendChild(row)
      })(REMIND_OPTS[i])
    }
  }

  function openRemindPicker() {
    buildRemind()
    buildUnits()
    setRemind($('fRemind') ? $('fRemind').value : '')
    fillCustom($('fRemind') ? $('fRemind').value : '')
    openSheet('sheetRemind')
  }

  /* ---------------- 选日期：自己的日历 ----------------
     手机自带的日期选择器也是个方框弹窗，跟主题不搭。这里自己做一个月历：
     紫色渐变头显示「选中的是哪天」，7×6 网格，有安排的日期底下带一个小点，
     上/下个月箭头，底部 清除 / 今天 / 确定。 */
  var dpY = 0, dpM = 0, dpSel = '', dpTarget = null

  function dpPickText() {
    var d = U.parse(dpSel + 'T00:00')
    return d ? ((d.getMonth() + 1) + '月' + d.getDate() + '日 周' + U.weekday(d)) : '未选'
  }

  function dpRender() {
    var grid = $('dpGrid')
    if (!grid) return
    var head = $('dpMonth'); if (head) head.textContent = dpY + '年' + (dpM + 1) + '月'
    var yr = $('dpYear'); if (yr) yr.textContent = dpY + '年'
    var pk = $('dpPick'); if (pk) pk.textContent = dpPickText()
    clear(grid)
    var first = new Date(dpY, dpM, 1)
    var start = new Date(dpY, dpM, 1 - first.getDay())        /* 从所在那一周的周日开始铺 */
    var today = U.todayStr()
    for (var i = 0; i < 42; i++) {                            /* 固定 6 行，高度不跳 */
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      var ds = U.dateStr(d)
      var cls = 'dp-d'
      if (d.getMonth() !== dpM) cls += ' out'
      if (ds === today) cls += ' today'
      if (ds === dpSel) cls += ' on'
      var b = el('button', cls, String(d.getDate()))
      b.setAttribute('data-d', ds)
      if (dotsFor(ds)) b.appendChild(el('i', 'dl'))           /* 那天有安排 → 一个小点 */
      dpTap(b, ds)
      grid.appendChild(b)
    }
  }

  function dpTap(cell, ds) {
    on(cell, 'click', function () { dpSelect(ds) })
  }

  function dpSelect(ds) {
    if (!ds) return
    var d = U.parse(ds + 'T00:00')
    if (d) { dpY = d.getFullYear(); dpM = d.getMonth() }
    dpSel = ds
    dpRender()
  }

  function dpShift(n) {
    var y = dpY, m = dpM + n
    y += Math.floor(m / 12)
    m = ((m % 12) + 12) % 12
    dpY = y; dpM = m
    dpRender()
  }

  function openDatePicker(input, title) {
    dpTarget = input || null
    var v = String((dpTarget && dpTarget.value) || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) v = S.date
    dpSel = v
    dpY = parseInt(v.slice(0, 4), 10); dpM = parseInt(v.slice(5, 7), 10) - 1
    var t = $('dpTitle'); if (t) t.textContent = title || '选择日期'
    dpRender()
    openSheet('sheetDate')
  }

  function dpCommit(clear) {
    if (dpTarget) dpTarget.value = clear ? '' : dpSel
    closeTop()
    updateHint()
  }

  /* ---------------- 时间选择：24 小时制拨轮 ----------------
     手机自带的时间选择器是个带表盘的方弹窗，又不好看、又只有 12 小时制（上午/下午）。
     这里换成两列拨轮（时 00–23 / 分 00–59）+ 24 小时制大数字预览：
     上下拨动、松手吸附到中间一行，圆角贴主题，没有表盘、没有上午下午。 */
  var TP_ITEM = 44                                   /* 每行高度，和 CSS 里 .tp-item 一致 */

  function tpCol(which) { return $(which === 'h' ? 'tpHour' : 'tpMin') }

  function tpMax(which) { return which === 'h' ? 23 : 59 }

  function tpBuild() {
    var H = $('tpHour'), M = $('tpMin'), i
    if (!H || !M || H.children.length) return
    for (i = 0; i < 24; i++) H.appendChild(el('div', 'tp-item', U.pad2(i)))
    for (i = 0; i < 60; i++) M.appendChild(el('div', 'tp-item', U.pad2(i)))
    /* 上下各留两行空白，第一行 / 最后一行也能拨到正中间 */
    H.style.paddingTop = (2 * TP_ITEM) + 'px'; H.style.paddingBottom = (2 * TP_ITEM) + 'px'
    M.style.paddingTop = (2 * TP_ITEM) + 'px'; M.style.paddingBottom = (2 * TP_ITEM) + 'px'
    on(H, 'scroll', function () { tpOnScroll() })
    on(M, 'scroll', function () { tpOnScroll() })
    tpTapToPick(H, 'h'); tpTapToPick(M, 'm')
  }

  function tpIndex(which) {
    var col = tpCol(which)
    if (!col || !col.children.length) return 0
    var n = Math.round((col.scrollTop || 0) / TP_ITEM)
    return Math.max(0, Math.min(tpMax(which), n))
  }

  function tpMark(which, idx) {
    var col = tpCol(which)
    if (!col) return
    for (var i = 0; i < col.children.length; i++) {
      if (i === idx) col.children[i].classList.add('on')
      else col.children[i].classList.remove('on')
    }
  }

  function tpPreview() {
    var h = tpIndex('h'), m = tpIndex('m')
    var ph = $('tpH'), pm = $('tpM')
    if (ph) ph.textContent = U.pad2(h)
    if (pm) pm.textContent = U.pad2(m)
    tpMark('h', h); tpMark('m', m)
    return { h: h, m: m }
  }

  var tpTimer = null
  function tpOnScroll() {
    tpPreview()
    if (tpTimer) clearTimeout(tpTimer)
    tpTimer = setTimeout(tpSnap, 120)                /* 松手后把选中行对到正中间 */
  }

  function tpSnap() {
    for (var k = 0; k < 2; k++) {
      var which = k ? 'm' : 'h', col = tpCol(which)
      if (!col) continue
      var want = tpIndex(which) * TP_ITEM
      if (Math.abs((col.scrollTop || 0) - want) > 0.5) col.scrollTop = want
    }
    tpPreview()
  }

  function tpSet(h, m) {
    var H = $('tpHour'), M = $('tpMin')
    if (!H || !M) return
    h = Math.max(0, Math.min(23, Number(h) || 0))
    m = Math.max(0, Math.min(59, Number(m) || 0))
    H.scrollTop = h * TP_ITEM
    M.scrollTop = m * TP_ITEM
    tpPreview()
  }

  /* 直接点某一行也能选中（除了拨动） */
  function tpTapToPick(col, which) {
    on(col, 'click', function (ev) {
      var box = col.getBoundingClientRect ? col.getBoundingClientRect() : null
      if (!box || ev.clientY === undefined) return
      var y = ev.clientY - box.top + (col.scrollTop || 0)
      var idx = Math.max(0, Math.min(tpMax(which), Math.floor(y / TP_ITEM)))
      col.scrollTop = idx * TP_ITEM
      tpPreview()
    })
  }

  var tpTarget = null
  function openTimePicker(input, title) {
    tpBuild()
    tpTarget = input || null
    var t = $('tpTitle'); if (t) t.textContent = title || '选择时间'
    var v = String((tpTarget && tpTarget.value) || '').match(/^(\d{1,2}):(\d{2})/)
    var now = new Date()
    var h = v ? parseInt(v[1], 10) : now.getHours()
    var m = v ? parseInt(v[2], 10) : now.getMinutes()
    tpSet(h, m)
    openSheet('sheetTime')
    /* sheet 从隐藏到显示后高度才有值，再定位一次更稳 */
    setTimeout(function () { tpSet(h, m) }, 30)
  }

  function tpValue() { var v = tpPreview(); return U.pad2(v.h) + ':' + U.pad2(v.m) }

  function tpCommit(clear) {
    if (tpTarget) tpTarget.value = clear ? '' : tpValue()
    closeTop()
    updateHint()
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindUI() {
    var vl = $('verLine')
    if (vl) vl.textContent = '紫色的蛋 v1.0.0'
    on($('fab'), 'click', function () { openAdd(null) })
    on($('cdBtn'), 'click', openNow)
    on($('btnStar'), 'click', function () { setFormStar(!S.formStar) })
    on($('mask'), 'click', closeTop)
    var xs = document.querySelectorAll('[data-close]')
    for (var i = 0; i < xs.length; i++) on(xs[i], 'click', closeTop)

    /* 点日期条上的某一天 → 看那一天；点不到日期条也能用前一天 / 今天 / 后一天 */
    on($('strip'), 'click', function (ev) {
      var node = closestDay(ev.target)
      if (node) setDate(node.getAttribute('data-d'))
    })
    on($('chipPrev'), 'click', function () { shiftDate(-1) })
    on($('chipNext'), 'click', function () { shiftDate(1) })
    on($('chipToday'), 'click', function () { setDate(U.todayStr()) })

    on($('btnSave'), 'click', saveForm)
    on($('fTitle'), 'keydown', function (e) { if (e.keyCode === 13) { e.preventDefault(); saveForm() } })
    on($('btnNow'), 'click', function () {
      var n = new Date()
      $('fStartDate').value = U.dateStr(n)
      $('fStartTime').value = U.pad2(n.getHours()) + ':' + U.pad2(n.getMinutes())
      updateHint()
    })
    on($('btnClearEnd'), 'click', function () { $('fEndDate').value = ''; $('fEndTime').value = ''; updateHint() })
    on($('fStartDate'), 'change', updateHint); on($('fStartTime'), 'change', updateHint)
    on($('fEndDate'), 'change', updateHint); on($('fEndTime'), 'change', updateHint)

    /* 日期 / 时间 / 提醒：点一下都弹自己的弹层，不再调手机自带的弹窗 */
    on($('btnRemind'), 'click', openRemindPicker)
    on($('rmCancel'), 'click', closeTop)
    on($('rmApply'), 'click', rmApply)
    on($('rmMinus'), 'click', function () { rmStep(-1) })
    on($('rmPlus'), 'click', function () { rmStep(1) })
    on($('fStartDate'), 'click', function () { openDatePicker($('fStartDate'), '开始日期') })
    on($('fEndDate'), 'click', function () { openDatePicker($('fEndDate'), '结束日期') })
    on($('dpPrev'), 'click', function () { dpShift(-1) })
    on($('dpNext'), 'click', function () { dpShift(1) })
    on($('dpToday'), 'click', function () { dpSelect(U.todayStr()) })
    on($('dpOk'), 'click', function () { dpCommit(false) })
    on($('dpClear'), 'click', function () { dpCommit(true) })
    on($('fStartTime'), 'click', function () { openTimePicker($('fStartTime'), '开始时间') })
    on($('fEndTime'), 'click', function () { openTimePicker($('fEndTime'), '结束时间') })
    on($('tpOk'), 'click', function () { tpCommit(false) })
    on($('tpClear'), 'click', function () { tpCommit(true) })
    on($('tpNow'), 'click', function () { var n = new Date(); tpSet(n.getHours(), n.getMinutes()) })

    on($('btnComplete'), 'click', function () {
      var e = find(S.detailId); closeSheets(); toggleDone(e)
    })
    on($('btnEdit2'), 'click', function () { var id = S.detailId; closeSheets(); setTimeout(function () { openEdit(id) }, 210) })
    on($('btnDelete'), 'click', function () {
      var id = S.detailId
      openConfirm('删除任务', '删除后无法恢复。', '删除', function () {
        closeSheets(); setTimeout(function () { removeEvent(id) }, 210)
      })
    })

    on($('chipBacklog'), 'click', function () { renderBacklog(); openSheet('sheetBacklog') })
    on($('btnDone'), 'click', function () { renderDone(); openSheet('sheetDone') })
    on($('chipHelp'), 'click', function () { openSheet('sheetHelp') })

    on($('btnClearDone'), 'click', function () {
      openConfirm('清空已完成', '已完成的任务会全部删掉。', '清空', function () {
        S.events = S.events.filter(function (e) { return e.status !== 'done' })
        persist(); renderDone(); renderAll(); toast('已清空')
      })
    })
    on($('btnExport'), 'click', function () {
      var json = JSON.stringify(S.events)
      if (window.ZC && ZC.shareText) { ZC.shareText('紫色的蛋备份 ' + U.todayStr(), json); }
      else openTextPrompt('导出备份（复制下面这段保存好）', '', json, function () { })
    })
    on($('btnImport'), 'click', function () {
      openTextPrompt('导入备份（把之前导出的内容粘进来）', '[{"id":"...","title":"..."}]', '', function (txt) {
        try {
          var arr = JSON.parse(txt)
          if (!arr || arr.length === undefined) throw new Error('格式不对')
          S.events = S.events.concat(arr)
          persist(); renderAll(); toast('已导入 ' + arr.length + ' 条')
        } catch (err) { toast('导入失败：' + err.message) }
      })
    })

    /* 点时间轴空白处 → 按该时间添加（只可能是 08:00–22:00） */
    on($('tlCanvas'), 'click', function (e) {
      var t = e.target
      if (t.className && String(t.className).indexOf('ev') === 0) return
      if (t.className && String(t.className).indexOf('pt') === 0) return
      var rect = $('tlCanvas').getBoundingClientRect()
      var y = e.clientY - rect.top
      var mins = TL_START + Math.round((y / HOUR) * 60 / 5) * 5
      if (mins < TL_START) mins = TL_START
      if (mins > TL_END - 5) mins = TL_END - 5
      openAdd(mins)
    })

    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderAll() })
    setInterval(function () { renderCountdown(); renderTimelineSafe() }, 30000)
  }

  function renderTimelineSafe() { try { renderTimeline() } catch (e) { } }

  /* ---------------- 示例数据（仅 ?demo=1 时，围绕当前时间生成，方便预览） ---------------- */
  function seedDemo() {
    var now = new Date()
    var base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    var h0 = now.getHours() - 1
    /* 示例数据要落在时间轴 08:00–22:00 里，才看得到轴上的样子 */
    if (h0 < 8) h0 = 8
    if (h0 > 16) h0 = 16
    var at = function (h, m) {
      var d = new Date(base.getTime())
      d.setHours(h, m || 0, 0, 0)
      return U.fmt(d)
    }
    var mk = function (title, s, e, from, to, note, st, color, remind) {
      return {
        id: U.uid(), title: title, startAt: s, endAt: e, from: from || '', to: to || '', note: note || '',
        status: st || 'todo', color: color || 'auto',
        remind: remind === undefined ? 0 : remind,
        createdAt: U.fmt(now), completedAt: st === 'done' ? U.fmt(now) : null
      }
    }
    S.events = [
      mk('和同学吃饭', at(h0, 0), at(h0, 30), '图书馆', '三食堂', '', 'done', '#FFD48A', null),
      mk('去图书馆自习', at(h0, 30), at(h0 + 3, 0), '宿舍', '图书馆', '带笔记本、充电器', 'todo', '#A97BFF'),
      mk('高数作业', at(h0 + 1, 0), at(h0 + 4, 0), '宿舍', '自习室', '', 'todo', '#8FB8FF'),
      mk('取快递', at(h0 + 2, 30), null, '图书馆', '菜鸟驿站', '取件码 2-3-1088', 'todo', '#FF9ED2'),
      mk('取快递（帮室友）', at(h0 + 2, 30), null, '图书馆', '菜鸟驿站', '第二件', 'todo', '#7ED9D2'),
      mk('交材料', null, at(h0 + 5, 0), '', '学院办公室', '截止前一定要交', 'todo', '#FFA98A', 30),
      mk('买文具', null, null, '超市', '宿舍', '笔芯 + 便利贴', 'todo', '#FF9ED2', null)
    ]
    persist()
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    S.events = K.load()
    /* ?d=YYYY-MM-DD 可直接打开某一天 */
    var md = location.search.match(/[?&]d=(\d{4}-\d{2}-\d{2})/)
    if (md) S.date = md[1]
    buildSwatches()
    bindUI()
    var demo = location.search.indexOf('demo=1') >= 0
    if (demo) seedDemo()
    renderAll()
    syncReminders()
    /* 预览钩子（只为了截图）：?new=1 铺开表单 / ?star=1 顺便打开重要开关 /
       ?tp= / ?dp= / ?rm= 再开对应弹层 / ?now=2 标前两件为重要并打开「接下来」 */
    var mt = location.search.match(/[?&]tp=(\d{1,2}):(\d{2})/)
    var md2 = location.search.match(/[?&]dp=(\d{4}-\d{2}-\d{2})/)
    var mr = location.search.match(/[?&]rm=(\d*)/)
    var mn = location.search.indexOf('new=1') >= 0
    var mstar = /[?&]star=1/.test(location.search)
    var mnow = location.search.match(/[?&]now=(\d*)/)
    if (mnow) setTimeout(function () {
      var n = parseInt(mnow[1], 10) || 0
      if (n > 0) {
        var up = upcomingList(n)
        for (var i = 0; i < up.length; i++) up[i].e.star = true
        persist(); renderAll()
      }
      openNow()
    }, 300)
    else if (mt || md2 || mr || mn) setTimeout(function () {
      openAdd(null)
      if (mstar) setFormStar(true)
      if (!mt && !md2 && !mr) return
      setTimeout(function () {
        if (mt) {
          var inp = $('fStartTime')
          inp.value = U.pad2(parseInt(mt[1], 10)) + ':' + U.pad2(parseInt(mt[2], 10))
          openTimePicker(inp, '开始时间')
        } else if (md2) {
          var din = $('fStartDate')
          din.value = md2[1]
          openDatePicker(din, '开始日期')
        } else {
          setRemind(mr[1])
          openRemindPicker()
        }
      }, 80)
    }, 300)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
  window.ZApp = {
    openAdd: openAdd, state: S, renderAll: renderAll,
    dotsFor: dotsFor,
    openTimePicker: openTimePicker, tpSet: tpSet, tpPreview: tpPreview,
    tpSnap: tpSnap, tpState: function () { return { h: tpIndex('h'), m: tpIndex('m'), target: tpTarget && tpTarget.id } },
    openDatePicker: openDatePicker, dpSelect: dpSelect, dpShift: dpShift, dpRender: dpRender,
    dpState: function () { return { y: dpY, m: dpM, sel: dpSel, target: dpTarget && dpTarget.id } },
    openRemindPicker: openRemindPicker, setRemind: setRemind, remindLabel: remindLabel,
    remindOptions: REMIND_OPTS, remindAt: remindAt,
    rmStep: rmStep, rmSetUnit: rmSetUnit, rmUnitKey: rmUnitKey, rmNumVal: rmNumVal,
    rmApply: rmApply, fillCustom: fillCustom, remindUnits: RM_UNITS,
    closeTop: closeTop, closeSheets: closeSheets, openSheet: openSheet,
    sheetState: function () { return { back: sheetBack } },
    openNow: openNow, renderNow: renderNow, isStar: isStar, toggleStar: toggleStar,
    setFormStar: setFormStar, upcomingList: upcomingList, starList: starList, whenLabel: whenLabel,
    setDate: setDate, shiftDate: shiftDate, legendItems: legendItems
  }
})()
