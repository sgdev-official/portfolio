/* Safety net: plain ES3 clock. Shows only if the full clock fails or is too slow. */
(function () {
  var box = null, tm = null, tt = null, dd = null, nt = null, h24 = true, timer = null, shown = false;
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function build() {
    if (box) return;
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:5;background:#000000;color:#ffe21a;' +
      'text-align:center;font-family:"Courier New",monospace;padding-top:18%;cursor:pointer';
    nt = document.createElement('div'); nt.style.cssText = 'font-size:13px;opacity:.7;padding:0 12px 18px';
    tm = document.createElement('div'); tm.style.cssText = 'font-weight:bold;letter-spacing:-2px';
    dd = document.createElement('div'); dd.style.cssText = 'font-size:18px;margin-top:12px';
    tt = document.createElement('div'); tt.style.cssText = 'font-size:12px;opacity:.6;margin-top:24px';
    tt.appendChild(document.createTextNode('Tap to switch 12/24 hour'));
    box.appendChild(nt); box.appendChild(tm); box.appendChild(dd); box.appendChild(tt);
    box.onclick = function () { h24 = !h24; tick(); };
    document.body.appendChild(box);
  }
  function tick() {
    var d = new Date(), hh = d.getHours(), ap = '';
    if (!h24) { ap = hh >= 12 ? ' PM' : ' AM'; hh = hh % 12 || 12; }
    var w = document.documentElement.clientWidth || 320;
    tm.style.fontSize = Math.floor(w / (h24 ? 6 : 8)) + 'px';
    tm.innerHTML = '';
    tm.appendChild(document.createTextNode(pad(hh) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ap));
    dd.innerHTML = '';
    dd.appendChild(document.createTextNode(DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear()));
  }
  var api = {
    show: function (msg) {
      build(); box.style.display = 'block'; shown = true;
      nt.innerHTML = ''; nt.appendChild(document.createTextNode(msg || 'Basic clock'));
      tick(); if (!timer) timer = setInterval(tick, 500);
    },
    hide: function () {
      if (box) box.style.display = 'none';
      shown = false; if (timer) { clearInterval(timer); timer = null; }
    }
  };
  window.ChronoBasic = api;
  window.onerror = function (msg) {
    if (!window.ChronoOK) api.show('Full clock could not load (' + msg + '). Showing the basic clock.');
    return false;
  };
  setTimeout(function () {
    if (!window.ChronoOK && !shown) api.show('Full clock is taking too long. Showing the basic clock.');
  }, 3500);
})();
