/* Install UI only: no data storage, service worker, cache, or automatic reload. */
(() => {
  'use strict';
  let promptEvent = null, busy = false, installed = false;
  const standalone = matchMedia('(display-mode: standalone)');
  const buttons = [...document.querySelectorAll('[data-install-app]')];
  const dialog = document.createElement('dialog');
  dialog.id = 'installAppDialog';
  dialog.setAttribute('aria-labelledby','installAppTitle');
  dialog.innerHTML = '<header><h2 id="installAppTitle">FitMetZorge installeren</h2><button type="button" class="secondary-btn" data-install-close aria-label="Installatiehulp sluiten">Sluiten</button></header><img src="assets/pwa/icon-192.png" alt="Origineel FitMetZorge-logo"><p data-install-instructions></p><p>Open daarna FitMetZorge vanaf je beginscherm. Meld je zo nodig opnieuw aan met je bestaande account. Je krijgt je eigen leden- of traineromgeving.</p><p class="muted">Opslaan en synchroniseren hebben internet nodig. Rond lopende invoer af voordat je het huidige tabblad sluit.</p>';
  document.body.append(dialog);
  function update() {
    const isStandalone = standalone.matches || navigator.standalone === true;
    buttons.forEach(button => { button.hidden = isStandalone; button.textContent = installed ? 'App geïnstalleerd' : 'App installeren'; button.disabled = busy || installed; });
  }
  function help(message) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    dialog.querySelector('[data-install-instructions]').textContent = message || (ios
      ? 'Open appfmz.nl in Safari. Tik op Deel → Zet op beginscherm. Zet “Open als webapp” aan als je die optie ziet en tik op Voeg toe. Zie je de optie niet, kies dan Bewerk taken in het deelmenu.'
      : 'Open het menu van je browser en kies “App installeren” of “Toevoegen aan beginscherm” als die optie beschikbaar is. Op een computer kun je ook het installatie-icoon in de adresbalk gebruiken. Niet elke browser biedt installatie aan.');
    if (!dialog.open) dialog.showModal();
  }
  addEventListener('beforeinstallprompt', event => { event.preventDefault(); promptEvent = event; update(); });
  addEventListener('appinstalled', () => { installed = true; promptEvent = null; if(dialog.open)dialog.close(); update(); });
  standalone.addEventListener('change', update);
  buttons.forEach(button => button.addEventListener('click', async () => {
    if (busy) return;
    if (!promptEvent) return help();
    const event = promptEvent; promptEvent = null; busy = true; update();
    try {
      await event.prompt();
      await event.userChoice;
      // Only appinstalled confirms installation; accepting the prompt alone does not.
    } catch { help('De installatie kon niet worden geopend. Probeer het via het menu van je browser: “App installeren” of “Toevoegen aan beginscherm”.'); }
    finally { busy = false; update(); }
  }));
  dialog.querySelector('[data-install-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if(event.target === dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close(); } });
  update();
})();
