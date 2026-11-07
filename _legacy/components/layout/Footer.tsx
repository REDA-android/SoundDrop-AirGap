'use client';

import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-2 py-4 px-2 font-mono text-xs text-[#A1A1AA] border-t border-white/10 mt-6 z-10">
      <span>DTLS/SCTP E2E • ZÉRO MOCK DATA • SYSTÈME DE FICHIERS RÉEL</span>
      <span>GGWAVE ECC • OPENDROP • LOCALSEND • SYNCTHING • WORMHOLE • WEBTORRENT</span>
    </footer>
  );
};
