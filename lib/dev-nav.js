const HAMBURGER = `<svg fill="currentColor" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/></svg>`;

export default function devNav({ allViewers, name: currentName }) {
  const links = allViewers.map(name => {
    const label = name.replace(/-/g, ' ');
    const active = name === currentName;
    const bg = active ? 'rgba(255,255,255,0.15)' : 'none';
    const color = active ? '#fff' : 'rgba(255,255,255,0.65)';
    const weight = active ? '600' : '400';
    return `<a href="/${name}" style="background:${bg};border-radius:4px;color:${color};font-weight:${weight};padding:4px 10px;text-decoration:none;white-space:nowrap">${label}</a>`;
  }).join('');

  return `
    <style>body { padding-bottom: 33px !important; }</style>
    <footer style="align-items:center;background:#1a1a1a;border-top:1px solid #333;bottom:0;box-sizing:border-box;display:flex;font-family:system-ui,sans-serif;font-size:12px;gap:4px;height:33px;left:0;padding:6px 12px;position:fixed;right:0;z-index:9999">
      ${links}
      <button type="button" onclick="const m=document.getElementById('dev-nav-modal');m.style.display=m.style.display==='none'?'flex':'none'" style="background:none;border:none;color:rgba(255,255,255,0.8);cursor:pointer;margin-left:auto;padding:4px">${HAMBURGER}</button>
    </footer>
    <div id="dev-nav-modal" onclick="if(event.target===event.currentTarget)this.style.display='none'" style="align-items:flex-start;background:rgba(0,0,0,0.5);bottom:0;display:none;justify-content:center;left:0;overflow-y:auto;padding-top:48px;position:fixed;right:0;top:0;z-index:10000">
      <div style="background:#fff;border-radius:8px;max-width:800px;overflow:hidden;width:90%">
        <div style="align-items:center;background:#3a3a3a;display:flex;padding:12px 16px">
          <h5 style="color:#fff;font-size:18px;font-weight:600;margin:0">FileMaker Layout Objects</h5>
          <button type="button" onclick="this.closest('#dev-nav-modal').style.display='none'" style="background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;margin-left:auto;padding:0 4px">&#x00D7;</button>
        </div>
        <div id="dev-nav-modal-body" style="max-height:70vh;overflow-y:auto;padding:16px"></div>
      </div>
    </div>`;
}
