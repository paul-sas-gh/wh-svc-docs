import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import BrowserOnly from '@docusaurus/BrowserOnly';

interface MermaidDiagramProps {
  chart: string;
}

mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
});

function MermaidDiagramComponent({ chart }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      try {
        mermaid.contentLoaded();
      } catch (e) {
        console.error('Mermaid rendering error:', e);
      }
    }
  }, [chart]);

  return (
    <div className="mermaid-diagram" ref={ref}>
      <div className="mermaid">{chart}</div>
    </div>
  );
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  return (
    <BrowserOnly fallback={<div>Loading diagram...</div>}>
      {() => <MermaidDiagramComponent chart={chart} />}
    </BrowserOnly>
  );
}
