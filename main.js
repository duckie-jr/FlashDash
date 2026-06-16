const LAUNCHER_WIDTH  = 400;
const LAUNCHER_HEIGHT = 580;

document.getElementById('openBtn').addEventListener('click', () => {
  const left = screen.width  - LAUNCHER_WIDTH;
  const top  = screen.height - LAUNCHER_HEIGHT;

  const launcherWindow = window.open(
    'USB/index.html',
    'AppLauncher',
    [
      `width=${LAUNCHER_WIDTH}`,
      `height=${LAUNCHER_HEIGHT}`,
      `left=${left}`,
      `top=${top}`,
      'resizable=no',
      'scrollbars=no',
      'status=no',
      'toolbar=no',
      'menubar=no',
      'location=no',
    ].join(',')
  );

  if (!launcherWindow) {
    alert('Popup blocked — please allow popups for this page and try again.');
  }
});
