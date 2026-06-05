export function openPrintDocument({ html, popupMessage, failureMessage, logLabel }) {
  const win = window.open('', '_blank', 'width=960,height=760');

  if (!win) {
    alert(popupMessage);
    return { printed: false, blocked: true };
  }

  let printed = false;
  const printOnce = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus?.();
      win.print();
    } catch (err) {
      console.error(`[useExport] ${logLabel} print failed:`, err);
      alert(failureMessage);
    }
  };

  win.addEventListener('load', () => window.setTimeout(printOnce, 400), { once: true });
  win.document.write(html);
  win.document.close();
  window.setTimeout(printOnce, 900);

  return {
    printed: false,
    blocked: false,
    printOnce,
  };
}
