import React from 'react';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

if (ExecutionEnvironment.canUseDOM) {
  console.log('[Mermaid Fullscreen Client Module] Initializing...');

  function initMermaidFullscreen() {
    console.log('[Mermaid Fullscreen] Init function called at:', new Date().toISOString());

    // Selectează toate containerele Mermaid (poate avea clase adiționale)
    const mermaidDiagrams = document.querySelectorAll('[class*="docusaurus-mermaid-container"]');

    console.log('[Mermaid Fullscreen] Found diagrams:', mermaidDiagrams.length);

    if (mermaidDiagrams.length === 0) {
      console.warn('[Mermaid Fullscreen] No diagrams found! Will retry...');
      // Retry după 2 secunde
      setTimeout(initMermaidFullscreen, 2000);
      return;
    }

    mermaidDiagrams.forEach((container, index) => {
      // Verifică dacă butonul a fost deja adăugat
      if (container.querySelector('.mermaid-fullscreen-btn')) {
        console.log('[Mermaid Fullscreen] Button already exists on diagram', index);
        return;
      }

      console.log('[Mermaid Fullscreen] Adding button to diagram', index, 'with class:', container.className);

      // Creează butonul de fullscreen
      const button = document.createElement('button');
      button.className = 'mermaid-fullscreen-btn';
      button.setAttribute('aria-label', 'Fullscreen');
      button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
        <span>Fullscreen</span>
      `;
      button.title = 'Deschide în fullscreen (Click)';

      // Event listener pentru buton
      button.addEventListener('click', (e) => {
        console.log('[Mermaid Fullscreen] Button clicked!');
        e.stopPropagation();
        openFullscreen(container);
      });

      // Asigură poziționare relativă
      if (!container.style.position || container.style.position === 'static') {
        container.style.position = 'relative';
      }

      container.appendChild(button);
      console.log('[Mermaid Fullscreen] Button successfully added to diagram', index);
    });
  }

  function openFullscreen(container) {
    console.log('[Mermaid Fullscreen] Opening fullscreen...');

    // Clonează conținutul diagramei
    const clone = container.cloneNode(true);

    // Șterge butonul de fullscreen din clonă (nu trebuie să apară în fullscreen)
    const cloneButton = clone.querySelector('.mermaid-fullscreen-btn');
    if (cloneButton) {
      cloneButton.remove();
    }

    // Elimină toate restricțiile de dimensiune din clonă
    clone.style.border = 'none';
    clone.style.padding = '0';
    clone.style.margin = '0';
    clone.style.maxWidth = 'none';
    clone.style.width = '100%';
    clone.style.height = '100%';

    // Găsește SVG-ul și forțează-l să ocupe tot spațiul
    const svg = clone.querySelector('svg');
    if (svg) {
      svg.style.maxWidth = 'none';
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.minWidth = '80vw'; // Minim 80% din lățimea ecranului
      svg.style.minHeight = '60vh'; // Minim 60% din înălțimea ecranului
    }

    // Creează container-ul fullscreen
    const fullscreenContainer = document.createElement('div');
    fullscreenContainer.className = 'mermaid-fullscreen-native';
    fullscreenContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: white;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      overflow: auto;
    `;

    // Aplică dark mode dacă este cazul
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
      fullscreenContainer.style.background = '#1b1b1d';
    }

    // Adaugă clona diagramei
    fullscreenContainer.appendChild(clone);

    // Adaugă hint text (discret, fără buton de închidere)
    const hint = document.createElement('div');
    hint.className = 'mermaid-fullscreen-hint';
    hint.textContent = 'Apasă ESC sau F11 pentru a ieși din fullscreen';
    hint.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255, 255, 255, 0.9);
      background: rgba(0, 0, 0, 0.75);
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      text-align: center;
      z-index: 10000;
      backdrop-filter: blur(10px);
      opacity: 1;
      transition: opacity 0.3s ease;
    `;

    fullscreenContainer.appendChild(hint);

    // Ascunde hint-ul după 3 secunde
    setTimeout(() => {
      hint.style.opacity = '0';
      setTimeout(() => hint.remove(), 300);
    }, 3000);

    // Funcție de închidere
    const close = () => {
      console.log('[Mermaid Fullscreen] Closing fullscreen...');

      // Ieșire din fullscreen API dacă este activ
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
      }

      document.body.style.overflow = '';
      fullscreenContainer.remove();
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };

    // Handler pentru ESC și F11
    const handleEscape = (e) => {
      if (e.key === 'Escape' || e.key === 'F11') {
        e.preventDefault();
        close();
      }
    };

    // Handler pentru fullscreen change (când user apasă F11 sau ESC în browser)
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // User a ieșit din fullscreen cu F11 sau ESC
        setTimeout(close, 100);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Previne scroll pe body
    document.body.style.overflow = 'hidden';

    // Adaugă container-ul în DOM
    document.body.appendChild(fullscreenContainer);
    console.log('[Mermaid Fullscreen] Fullscreen container added to DOM');

    // Încearcă să activeze fullscreen API nativ
    setTimeout(() => {
      if (fullscreenContainer.requestFullscreen) {
        fullscreenContainer.requestFullscreen().then(() => {
          console.log('[Mermaid Fullscreen] Native fullscreen API activated!');
        }).catch(err => {
          console.log('[Mermaid Fullscreen] Fullscreen API not available or blocked:', err);
          // Funcționează oricum cu CSS fullscreen
        });
      } else {
        console.log('[Mermaid Fullscreen] Fullscreen API not supported, using CSS fallback');
      }
    }, 100);
  }

  // Init când documentul este gata
  console.log('[Mermaid Fullscreen] Setting up initialization...');
  console.log('[Mermaid Fullscreen] Document ready state:', document.readyState);

  // Init imediat dacă documentul e deja loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('[Mermaid Fullscreen] Document already ready, calling init immediately');
    setTimeout(initMermaidFullscreen, 500);
  } else {
    console.log('[Mermaid Fullscreen] Waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[Mermaid Fullscreen] DOMContentLoaded fired!');
      setTimeout(initMermaidFullscreen, 500);
    });
  }

  // Init și la window load (backup)
  window.addEventListener('load', () => {
    console.log('[Mermaid Fullscreen] Window load event fired!');
    setTimeout(initMermaidFullscreen, 1000);
  });

  // Observer pentru detectarea noilor diagrame (pentru dynamic content)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // Verifică dacă nodul adăugat este sau conține un container Mermaid
          if (node.className && typeof node.className === 'string' &&
              node.className.includes('docusaurus-mermaid-container')) {
            console.log('[Mermaid Fullscreen] New Mermaid diagram detected via MutationObserver!');
            setTimeout(initMermaidFullscreen, 500);
          } else if (node.querySelector) {
            const mermaidContainers = node.querySelectorAll('[class*="docusaurus-mermaid-container"]');
            if (mermaidContainers.length > 0) {
              console.log('[Mermaid Fullscreen] New Mermaid diagrams detected in added node:', mermaidContainers.length);
              setTimeout(initMermaidFullscreen, 500);
            }
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('[Mermaid Fullscreen] MutationObserver started');

  // Expune funcția global pentru debugging
  window.debugMermaidFullscreen = initMermaidFullscreen;
  console.log('[Mermaid Fullscreen] Debug function exposed: window.debugMermaidFullscreen()');
}

// Export componenta Root (wrapper pentru toată aplicația)
export default function Root({children}) {
  return <>{children}</>;
}
