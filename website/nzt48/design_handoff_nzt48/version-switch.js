/* Preview-only version switcher (bottom right). Add a new version = add one line below. Not for production. */
(function () {
  var VERSIONS = [
    { v: 'V1', name: '3D', file: 'NZT48 V1 - 3D.dc.html' },
    { v: 'V2', name: 'Magazine', file: 'NZT48 V2 - Magazine.dc.html' },
    { v: 'V3', name: 'Cinematic', file: 'NZT48 V3 - Cinematic.html' },
  ];
  if (/[?&]embed=1/.test(location.search)) return;
  // Colour theme preview (pages marked data-themeable): dark = original, light = V2's cream & blue
  var root = document.documentElement, themed = root.hasAttribute('data-themeable');
  var theme = 'dark'; try { theme = localStorage.getItem('nzt-theme') || 'dark'; } catch (e) {}
  if (themed) root.setAttribute('data-theme', theme);
  var path = decodeURIComponent(location.pathname);
  var cur = VERSIONS.findIndex(function (x) { return path.endsWith('/' + x.file); });

  // Section the viewer is on, so switching lands on the same spot
  function sectionNow() {
    var hit = null, H = innerHeight;
    document.querySelectorAll('section[id],[data-section]').forEach(function (s) {
      if (s.getBoundingClientRect().top <= H * 0.35) hit = s.id || s.getAttribute('data-section');
    });
    return hit;
  }

  function build() {
    if (innerWidth < 900) return; // phones: no version links, only the small theme icon
    var wrap = document.createElement('div');
    wrap.id = 'lx-version-switch';
    wrap.style.cssText = 'position:fixed;right:16px;bottom:' + (innerWidth < 900 ? '88px' : '16px') + ';z-index:2147483000;display:flex;gap:4px;padding:5px;border-radius:999px;background:#111;box-shadow:0 10px 30px rgba(0,0,0,.4);font:600 13px/1 Poppins,Arial,sans-serif';
    VERSIONS.forEach(function (x, i) {
      var b = document.createElement('button'), on = i === cur;
      b.type = 'button';
      b.textContent = x.v + ' · ' + x.name;
      b.style.cssText = 'border:0;cursor:pointer;height:36px;padding:0 14px;border-radius:999px;white-space:nowrap;font:inherit;background:' + (on ? '#E2C675' : 'rgba(255,255,255,.1)') + ';color:' + (on ? '#111' : '#fff');
      if (!on) b.onclick = function () { var id = sectionNow(); location.href = encodeURI(x.file) + (id ? '#v=' + id : ''); };
      wrap.appendChild(b);
    });
    document.body.appendChild(wrap);
  }

  function restore() {
    var m = /#v=([\w-]+)/.exec(location.hash), tries = 0;
    if (!m) return;
    (function go() {
      var el = document.getElementById(m[1]) || document.querySelector('[data-section="' + m[1] + '"]');
      if (el && tries > 3) { scrollTo(0, el.getBoundingClientRect().top + scrollY); history.replaceState(null, '', location.pathname); }
      else if (tries++ < 30) setTimeout(go, 200);
    })();
  }

  // Separate colour-theme pill, bottom left (only on pages that support it)
  function buildTheme() {
    if (!themed) return;
    if (innerWidth < 900) { // phones: one small round icon in the corner (moon = switch to dark, sun = switch to light)
      var MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
      var SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
      var ib = document.createElement('button'); ib.type = 'button'; ib.id = 'lx-theme-switch';
      ib.style.cssText = 'position:fixed;right:12px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:2147483000;width:40px;height:40px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;color:#fff;background:rgba(17,17,17,.72);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 6px 18px rgba(0,0,0,.3)';
      var paintI = function () { ib.innerHTML = theme === 'light' ? MOON : SUN; ib.setAttribute('aria-label', 'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' colours'); };
      ib.onclick = function () { theme = theme === 'light' ? 'dark' : 'light'; root.setAttribute('data-theme', theme); try { localStorage.setItem('nzt-theme', theme); } catch (e) {} paintI(); };
      paintI(); document.body.appendChild(ib); return;
    }
    var box = document.createElement('div');
    box.id = 'lx-theme-switch';
    box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Colour theme');
    box.style.cssText = 'position:fixed;left:16px;bottom:' + (innerWidth < 900 ? '140px' : '16px') + ';z-index:2147483000;display:flex;gap:4px;padding:5px;border-radius:999px;background:#111;box-shadow:0 10px 30px rgba(0,0,0,.4);font:600 13px/1 Poppins,Arial,sans-serif';
    var opts = [['dark', 'Dark'], ['light', 'Light']], btns = [];
    var paint = function () { btns.forEach(function (b) { var on = b.dataset.t === theme; b.setAttribute('aria-pressed', on); b.style.background = on ? (theme === 'light' ? '#26357A' : '#E2C675') : 'rgba(255,255,255,.1)'; b.style.color = on && theme === 'dark' ? '#111' : '#fff'; }); };
    opts.forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.dataset.t = o[0]; b.textContent = o[1];
      b.style.cssText = 'border:0;cursor:pointer;height:36px;padding:0 16px;border-radius:999px;white-space:nowrap;font:inherit';
      b.onclick = function () { theme = o[0]; root.setAttribute('data-theme', theme); try { localStorage.setItem('nzt-theme', theme); } catch (e) {} paint(); };
      btns.push(b); box.appendChild(b);
    });
    paint(); document.body.appendChild(box);
  }
  function init() { build(); buildTheme(); restore(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
