
const CURSORS = {
  top: 'n-resize',
  bottom: 's-resize',
  left: 'w-resize',
  right: 'e-resize',
  'top-left': 'nw-resize',
  'top-right': 'ne-resize',
  'bottom-left': 'sw-resize',
  'bottom-right': 'se-resize',
};

document.querySelectorAll('.resize-handle').forEach(handle => {
  const dir = handle.dataset.dir;
  handle.style.cursor = CURSORS[dir] || 'default';

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    window.electronAPI.startResizing(dir);

    function onMouseUp() {
      window.electronAPI.stopResizing();
      window.removeEventListener('mouseup', onMouseUp);
    }
    window.addEventListener('mouseup', onMouseUp);
  });
});

window.electronAPI.onConfigUpdate((cfg) => {
  document.querySelectorAll('.resize-handle').forEach(h => {
    h.style.pointerEvents = cfg.clickThrough ? 'none' : 'auto';
  });
});
