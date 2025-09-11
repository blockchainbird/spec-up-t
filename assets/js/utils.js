function delegateEvent(type, selector, fn, options = {}){
  return (options.container || document).addEventListener(type, e => {
    let match = e.target.closest(selector);
    if (match) fn(e, match);
  }, options);
}

const skipAnimationFrame = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

const domReady = new Promise(resolve => {
  document.addEventListener('DOMContentLoaded', e => resolve())
});