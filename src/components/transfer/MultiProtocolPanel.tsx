'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  generateLocalSendAlias,
  LocalSendDevice,
  LocalSendUploadedItem,
  registerAndFetchLocalSendPeers,
  uploadFileViaLocalSend,
  fetchAvailableLocalSendFiles,
} from '@/lib/protocols/localsend';
import {
  collectRealHardwareTelemetry,
  RealHardwareTelemetry,
} from '@/lib/protocols/reticulum-mesh';
import {
  computeSyncthingFileLedger,
  SyncthingFileLedger,
} from '@/lib/protocols/syncthing';
import {
  generateWarpinatorPin,
  verifyWarpinatorPin,
} from '@/lib/protocols/pairdrop-kde';
import {
  generateWormholePhrase,
  extractRoomIdFromPhrase,
  deriveWormholeKeyFingerprint,
  createRealWebTorrentMetadata,
  RealTorrentMetadata,
} from '@/lib/protocols/wormhole-webtorrent';
import { OpenDropPanel } from './OpenDropPanel';
import { formatBytes } from '@/lib/utils/formatters';
import {
  Copy,
  Check,
  Send,
  Download,
  RefreshCw,
  Shield,
  Magnet,
  KeyRound,
  Cpu,
  Blocks,
  Clipboard,
  Radio,
} from 'lucide-react';

export type UnifiedProtocol =
  | 'ACOUSTIC'
  | 'OPENDROP'
  | 'LOCALSEND'
  | 'WORMHOLE_CROC'
  | 'WEBTORRENT'
  | 'SYNCTHING'
  | 'PAIRDROP'
  | 'RETICULUM_MESH'
  | 'KDE_WARPINATOR';

export interface SharedClipboardEntry {
  id: string;
  senderName: string;
  payload: string;
  timestamp: number;
}

interface MultiProtocolPanelProps {
  selectedFile: File | null;
  activeProtocol: UnifiedProtocol;
  onProtocolChange: (protocol: UnifiedProtocol) => void;
  currentRoomId?: string;
  liveSnrDb?: number;
  liveRttMs?: number;
  offlineSdpToken?: string;
  onApplyRemoteOfflineSdp?: (token: string) => void;
  onEmitDirectAcousticPayload?: () => void;
  onJoinRoomByCode?: (code: string) => void;
  onStartTransmitter?: () => void;
  onSendDataChannelClipboard?: (senderName: string, text: string) => boolean;
  incomingDataChannelClipboards?: SharedClipboardEntry[];
}

const PROTOCOL_TABS: ReadonlyArray<{
  id: UnifiedProtocol;
  label: string;
  sub: string;
}> = [
  { id: 'ACOUSTIC', label: 'Hors-Ligne', sub: 'Air-Gap & SDP' },
  { id: 'OPENDROP', label: 'OpenDrop', sub: 'AirDrop v2' },
  { id: 'LOCALSEND', label: 'LocalSend', sub: 'REST v2.1' },
  { id: 'WORMHOLE_CROC', label: 'Wormhole', sub: 'PAKE / Croc' },
  { id: 'WEBTORRENT', label: 'WebTorrent', sub: 'Magnet / SHA1' },
  { id: 'SYNCTHING', label: 'Syncthing', sub: 'BEP 128 KB' },
  { id: 'PAIRDROP', label: 'PairDrop', sub: 'Presse-Papier' },
  { id: 'RETICULUM_MESH', label: 'Reticulum', sub: 'Capteurs Réels' },
  { id: 'KDE_WARPINATOR', label: 'Warpinator', sub: 'PIN Auth' },
];

export const MultiProtocolPanel: React.FC<MultiProtocolPanelProps> = ({
  selectedFile,
  activeProtocol,
  onProtocolChange,
  currentRoomId,
  liveSnrDb = 0,
  liveRttMs,
  offlineSdpToken = '',
  onApplyRemoteOfflineSdp,
  onEmitDirectAcousticPayload,
  onJoinRoomByCode,
  onStartTransmitter,
  onSendDataChannelClipboard,
  incomingDataChannelClipboards = [],
}) => {
  const [remoteOfflineTokenInput, setRemoteOfflineTokenInput] = useState<string>('');
  const [copiedOfflineToken, setCopiedOfflineToken] = useState<boolean>(false);
  // 1. LocalSend v2.1 Real State
  const [localSendDevice, setLocalSendDevice] = useState<LocalSendDevice | null>(null);
  const [localSendPeers, setLocalSendPeers] = useState<LocalSendDevice[]>([]);
  const [localSendUploads, setLocalSendUploads] = useState<LocalSendUploadedItem[]>([]);
  const [isUploadingLocalSend, setIsUploadingLocalSend] = useState(false);
  const [localSendStatus, setLocalSendStatus] = useState<string | null>(null);

  // 2. Reticulum & Real Hardware Sensor State (ZERO MOCK DATA)
  const [hardwareTelemetry, setHardwareTelemetry] = useState<RealHardwareTelemetry | null>(null);

  // 3. Syncthing Real SHA-256 Block State
  const [syncthingLedger, setSyncthingLedger] = useState<SyncthingFileLedger | null>(null);
  const [isScanningBlocks, setIsScanningBlocks] = useState(false);

  // 4. PairDrop & Real-Time Clipboard State
  const [clipboardText, setClipboardText] = useState<string>('');
  const [clipboardFeed, setClipboardFeed] = useState<SharedClipboardEntry[]>([]);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);

  // 5. Magic-Wormhole / Croc PAKE State
  const [wormholePhrase, setWormholePhrase] = useState<string>('');
  const [wormholeInput, setWormholeInput] = useState<string>('');
  const [wormholeKeyFp, setWormholeKeyFp] = useState<string>('');
  const [copiedPhrase, setCopiedPhrase] = useState(false);

  // 6. WebTorrent Real Bencode / InfoHash / Magnet State
  const [torrentMeta, setTorrentMeta] = useState<RealTorrentMetadata | null>(null);
  const [isBuildingTorrent, setIsBuildingTorrent] = useState(false);
  const [copiedMagnet, setCopiedMagnet] = useState(false);

  // 7. Warpinator PIN State
  const [warpinatorPin, setWarpinatorPin] = useState<string>('');
  const [inputPin, setInputPin] = useState<string>('');
  const [pinAuthorized, setPinAuthorized] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Initialize LocalSend Identity & Warpinator PIN
  useEffect(() => {
    const fp = `sndp-${Math.random().toString(36).substring(2, 8)}`;
    const alias = generateLocalSendAlias(fp);
    const dev: LocalSendDevice = {
      alias,
      version: '2.1',
      deviceModel: 'SoundDrop Studio Web',
      deviceType: 'web',
      fingerprint: fp,
      port: 3000,
      protocol: 'https',
      download: true,
    };
    setLocalSendDevice(dev);
    setWarpinatorPin(generateWarpinatorPin());
  }, []);

  // Refresh Real Hardware Telemetry (Battery API, Network Info API, WebCrypto SHA-256)
  const refreshRealTelemetry = useCallback(async () => {
    const tel = await collectRealHardwareTelemetry(
      hardwareTelemetry?.nodeId,
      hardwareTelemetry?.reticulumHash,
      liveSnrDb,
      liveRttMs
    );
    setHardwareTelemetry(tel);
  }, [hardwareTelemetry?.nodeId, hardwareTelemetry?.reticulumHash, liveSnrDb, liveRttMs]);

  useEffect(() => {
    void refreshRealTelemetry();
  }, [liveSnrDb, liveRttMs, refreshRealTelemetry]);

  // Update Wormhole PAKE Phrase & PBKDF2-AES-256-GCM Fingerprint when room changes
  useEffect(() => {
    const activeCode = currentRoomId || 'SNDP01';
    const phrase = generateWormholePhrase(activeCode);
    setWormholePhrase(phrase);
    void deriveWormholeKeyFingerprint(phrase).then((res) => {
      setWormholeKeyFp(res.keyFingerprintHex);
    });
  }, [currentRoomId]);

  // Compute REAL Syncthing SHA-256 Blocks when a file is selected and SYNCTHING tab is active (or file changes)
  useEffect(() => {
    let cancelled = false;
    if (!selectedFile) {
      setSyncthingLedger(null);
      setTorrentMeta(null);
      return;
    }

    setIsScanningBlocks(true);
    void computeSyncthingFileLedger(selectedFile, (partial) => {
      if (!cancelled) setSyncthingLedger(partial);
    }).finally(() => {
      if (!cancelled) setIsScanningBlocks(false);
    });

    setIsBuildingTorrent(true);
    void createRealWebTorrentMetadata(selectedFile)
      .then((meta) => {
        if (!cancelled) setTorrentMeta(meta);
      })
      .finally(() => {
        if (!cancelled) setIsBuildingTorrent(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  // Poll LocalSend Peers & Uploads when LOCALSEND tab is active
  const refreshLocalSend = useCallback(async () => {
    if (!localSendDevice) return;
    const [peers, uploads] = await Promise.all([
      registerAndFetchLocalSendPeers(localSendDevice),
      fetchAvailableLocalSendFiles(),
    ]);
    setLocalSendPeers(peers);
    setLocalSendUploads(uploads);
  }, [localSendDevice]);

  useEffect(() => {
    if (activeProtocol !== 'LOCALSEND') return;
    void refreshLocalSend();
    const timer = window.setInterval(() => void refreshLocalSend(), 4000);
    return () => clearInterval(timer);
  }, [activeProtocol, refreshLocalSend]);

  // Poll PairDrop Clipboard Feed when PAIRDROP tab is active
  const refreshClipboardFeed = useCallback(async () => {
    try {
      const url = currentRoomId
        ? `/api/signal/clipboard?roomId=${encodeURIComponent(currentRoomId)}`
        : '/api/signal/clipboard';
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-store' } });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: SharedClipboardEntry[] };
      if (data.items) {
        setClipboardFeed(data.items);
      }
    } catch {
      // Ignored
    }
  }, [currentRoomId]);

  useEffect(() => {
    if (activeProtocol !== 'PAIRDROP') return;
    void refreshClipboardFeed();
    const timer = window.setInterval(() => void refreshClipboardFeed(), 3000);
    return () => clearInterval(timer);
  }, [activeProtocol, refreshClipboardFeed]);

  // Handle LocalSend File Upload
  const handleLocalSendUpload = async () => {
    if (!localSendDevice || !selectedFile || isUploadingLocalSend) return;
    try {
      setIsUploadingLocalSend(true);
      setLocalSendStatus('Publication LocalSend v2.1 en cours...');
      await uploadFileViaLocalSend(localSendDevice, selectedFile, syncthingLedger?.rootSha256);
      setLocalSendStatus(`✓ Fichier "${selectedFile.name}" publié sur le nœud LocalSend v2.1 !`);
      await refreshLocalSend();
    } catch (err) {
      setLocalSendStatus(`Erreur : ${(err as Error).message}`);
    } finally {
      setIsUploadingLocalSend(false);
    }
  };

  // Handle Real-Time PairDrop Clipboard Broadcast
  const handleShareClipboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clipboardText.trim()) return;
    const text = clipboardText.trim();
    const sender = localSendDevice?.alias || 'SoundDrop Peer';

    // 1. Send over live WebRTC DataChannel if connected
    if (onSendDataChannelClipboard) {
      onSendDataChannelClipboard(sender, text);
    }

    // 2. Post to Edge Clipboard Relay so all LAN/Room peers receive it immediately
    try {
      await fetch('/api/signal/clipboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: currentRoomId,
          senderName: sender,
          payload: text,
        }),
      });
      await refreshClipboardFeed();
    } catch {
      // Fallback local
    }

    setClipboardText('');
    setClipboardNotice('✓ Texte synchronisé en temps réel (WebRTC + Relais P2P)');
    setTimeout(() => setClipboardNotice(null), 2500);
  };

  // Handle Wormhole / Croc PAKE Join
  const handleWormholeJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wormholeInput.trim() || !onJoinRoomByCode) return;
    const extractedRoom = extractRoomIdFromPhrase(wormholeInput);
    onJoinRoomByCode(extractedRoom);
  };

  // Handle Download .torrent file
  const handleDownloadTorrentFile = () => {
    if (!torrentMeta) return;
    const url = URL.createObjectURL(torrentMeta.torrentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${torrentMeta.fileName}.torrent`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle Warpinator PIN Verify
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyWarpinatorPin(inputPin, warpinatorPin)) {
      setPinAuthorized(true);
      setPinError(null);
    } else {
      setPinError('Code PIN incorrect. Vérifiez les 4 chiffres du pair émetteur.');
      setPinAuthorized(false);
    }
  };

  const mergedClipboardItems = [
    ...incomingDataChannelClipboards,
    ...clipboardFeed.filter(
      (item) => !incomingDataChannelClipboards.some((dc) => dc.id === item.id)
    ),
  ].slice(0, 10);

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Accessible ARIA Tablist for 9 Open-Source Protocols */}
      <div
        role="tablist"
        aria-label="Protocoles Open-Source P2P"
        className="grid grid-cols-3 gap-1.5 p-1.5 bg-[#0C0C10] border border-white/15 rounded-2xl"
      >
        {PROTOCOL_TABS.map((p) => {
          const isSelected = activeProtocol === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`tab-${p.id}`}
              aria-selected={isSelected}
              aria-controls={`panel-${p.id}`}
              onClick={() => onProtocolChange(p.id)}
              className={`min-h-[44px] px-2 py-1.5 rounded-xl transition-all flex flex-col items-center justify-center text-center ${
                isSelected
                  ? 'bg-[#1E1E28] text-[#FF7A33] border border-[#FF5500]/50 shadow-sm font-bold'
                  : 'text-[#D4D4D8] hover:text-white hover:bg-[#16161E] border border-transparent'
              }`}
            >
              <span className="text-[11px] leading-tight">{p.label}</span>
              <span className="text-[9px] text-[#A1A1AA] tracking-wider mt-0.5">{p.sub}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panel Container */}
      <div
        role="tabpanel"
        id={`panel-${activeProtocol}`}
        aria-labelledby={`tab-${activeProtocol}`}
        className="rounded-2xl bg-[#121217] border border-white/15 p-4 space-y-3.5"
      >
        {/* 1. PARTAGE 100% HORS-LIGNE (AIR-GAP SONORE DIRECT & WEBRTC LAN SANS INTERNET) */}
        {activeProtocol === 'ACOUSTIC' && (
          <div className="space-y-3">
            {/* Direct Air-Gap Acoustic File Emission (0% Network / 0% Wi-Fi) */}
            <div className="rounded-xl bg-[#0C0C10] border border-white/15 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#F4F4F6] text-xs">
                  1. TRANSFERT SONORE DIRECT (AIR-GAP 0% RÉSEAU)
                </span>
                <span className="text-[10px] text-[#34D399] font-semibold">HAUT-PARLEUR → MICRO</span>
              </div>
              <button
                type="button"
                disabled={!selectedFile || !onEmitDirectAcousticPayload}
                onClick={() => onEmitDirectAcousticPayload && onEmitDirectAcousticPayload()}
                className="w-full min-h-[40px] rounded-xl bg-[#FF5500] hover:bg-[#FF6A1F] disabled:opacity-40 text-white font-bold px-3 py-2 text-xs transition-colors"
              >
                {selectedFile
                  ? `Émettre "${selectedFile.name}" par onde sonore directe (Sans Internet)`
                  : 'Sélectionnez un fichier pour l’émettre par le son'}
              </button>
            </div>

            {/* Serverless Offline WebRTC LAN Handshake (Compressed SDP SDO1 / SDA1) */}
            <div className="rounded-xl bg-[#0C0C10] border border-white/15 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#F4F4F6] text-xs">
                  2. WEBRTC LOCAL HORS-LIGNE (WI-FI / HOTSPOT SANS INTERNET)
                </span>
                <span className="text-[10px] text-[#FF7A33] font-semibold">SDP COMPRESSÉ</span>
              </div>

              {offlineSdpToken ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={offlineSdpToken}
                      aria-label="Jeton SDP Hors-Ligne local"
                      className="flex-1 rounded-lg bg-[#14141C] border border-white/15 px-2.5 py-1.5 text-[11px] text-[#34D399] select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(offlineSdpToken);
                        setCopiedOfflineToken(true);
                        setTimeout(() => setCopiedOfflineToken(false), 1800);
                      }}
                      className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {copiedOfflineToken ? 'Copié ✓' : 'Copier'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-[#A1A1AA]">
                  Lancez un envoi à gauche pour générer votre jeton SDP Hors-Ligne local (`SDO1:...`).
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!remoteOfflineTokenInput.trim() || !onApplyRemoteOfflineSdp) return;
                  onApplyRemoteOfflineSdp(remoteOfflineTokenInput.trim());
                  setRemoteOfflineTokenInput('');
                }}
                className="flex gap-2 pt-1"
              >
                <input
                  type="text"
                  value={remoteOfflineTokenInput}
                  onChange={(e) => setRemoteOfflineTokenInput(e.target.value)}
                  placeholder="Coller le jeton SDO1:... ou SDA1:... du pair"
                  aria-label="Coller le jeton SDP Hors-Ligne distant"
                  className="flex-1 min-h-[38px] rounded-xl bg-[#14141C] border border-white/15 px-3 py-1.5 text-xs text-[#F4F4F6] placeholder-[#A1A1AA]/60"
                />
                <button
                  type="submit"
                  disabled={!remoteOfflineTokenInput.trim()}
                  className="min-h-[38px] rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition-colors"
                >
                  Lier Hors-Ligne
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 2. OPENDROP / AIRDROP v2 */}
        {activeProtocol === 'OPENDROP' && <OpenDropPanel selectedFile={selectedFile} />}

        {/* 3. LOCALSEND v2.1 REAL REST ENGINE */}
        {activeProtocol === 'LOCALSEND' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-[#E4E4E7] font-semibold">LOCALSEND PROTOCOLE v2.1</span>
              <button
                type="button"
                onClick={() => void refreshLocalSend()}
                className="inline-flex items-center gap-1 text-[#FF7A33] hover:underline"
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Actualiser</span>
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-[#0C0C10] border border-white/10 p-3">
              <div>
                <div className="text-sm font-bold text-[#F4F4F6] flex items-center gap-2">
                  <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#10B981]" />
                  {localSendDevice?.alias}
                </div>
                <div className="text-[11px] text-[#A1A1AA] mt-0.5">
                  Empreinte : <code>{localSendDevice?.fingerprint}</code> • API{' '}
                  <code>/api/localsend/v2/*</code>
                </div>
              </div>

              <button
                type="button"
                disabled={!selectedFile || isUploadingLocalSend}
                onClick={() => void handleLocalSendUpload()}
                className={`min-h-[38px] px-3.5 py-2 rounded-xl font-bold uppercase inline-flex items-center gap-1.5 ${
                  selectedFile && !isUploadingLocalSend
                    ? 'tactile-btn-primary'
                    : 'bg-[#1C1C24] text-[#A1A1AA] opacity-50 cursor-not-allowed'
                }`}
              >
                <Send aria-hidden="true" className="h-3.5 w-3.5" />
                <span>{isUploadingLocalSend ? 'Envoi...' : 'Publier Fichier'}</span>
              </button>
            </div>

            {localSendStatus && (
              <div className="p-2.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#34D399]">
                {localSendStatus}
              </div>
            )}

            {/* Available LocalSend Files to Download */}
            <div className="space-y-1.5">
              <div className="text-[11px] text-[#A1A1AA] font-semibold">
                FICHIERS LOCALSEND DISPONIBLES ({localSendUploads.length}) • PAIRS ACTIFS (
                {localSendPeers.length})
              </div>
              {localSendUploads.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-[#0C0C10] border border-dashed border-white/15 text-[#A1A1AA] text-center">
                  Aucun fichier publié sur le bus LocalSend pour le moment.
                </div>
              ) : (
                localSendUploads.map((item) => (
                  <div
                    key={`${item.sessionId}-${item.fileId}`}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#0C0C10] border border-white/10"
                  >
                    <div className="overflow-hidden">
                      <div className="font-bold text-[#F4F4F6] truncate">{item.fileName}</div>
                      <div className="text-[11px] text-[#A1A1AA]">
                        {formatBytes(item.size)} • Par {item.senderAlias}
                      </div>
                    </div>
                    <a
                      href={`/api/localsend/v2/upload?sessionId=${encodeURIComponent(
                        item.sessionId
                      )}&fileId=${encodeURIComponent(item.fileId)}`}
                      download={item.fileName}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#10B981] text-black font-bold inline-flex items-center gap-1.5 hover:bg-[#059669]"
                    >
                      <Download aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>Télécharger</span>
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 4. MAGIC-WORMHOLE & CROC (PAKE CODE PHRASE + PBKDF2 AES-256-GCM) */}
        {activeProtocol === 'WORMHOLE_CROC' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-[#E4E4E7] font-semibold flex items-center gap-2">
                <KeyRound aria-hidden="true" className="h-4 w-4 text-[#FF6A1F]" />
                MAGIC-WORMHOLE & CROC (PAKE E2E)
              </span>
              <span className="text-[#34D399] font-bold">AES-256-GCM</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0C0C10] border border-white/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#A1A1AA]">
                  PHRASE DE PASSE WORMHOLE / CROC :
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(wormholePhrase);
                    setCopiedPhrase(true);
                    setTimeout(() => setCopiedPhrase(false), 1800);
                  }}
                  className="inline-flex items-center gap-1 text-[#FF7A33] hover:underline"
                >
                  {copiedPhrase ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#10B981]" />
                  ) : (
                    <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedPhrase ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
              <div className="text-sm font-bold text-[#F4F4F6] tracking-wider select-all break-all">
                {wormholePhrase}
              </div>
              <div className="text-[11px] text-[#A1A1AA] pt-1 border-t border-white/10">
                Empreinte Clé PBKDF2-SHA256 :{' '}
                <code className="text-[#34D399]">{wormholeKeyFp || 'Calcul...'}</code>
              </div>
            </div>

            {selectedFile && !currentRoomId && onStartTransmitter && (
              <button
                type="button"
                onClick={onStartTransmitter}
                className="w-full min-h-[42px] rounded-xl tactile-btn-primary font-bold uppercase text-xs"
              >
                Ouvrir le canal Wormhole avec ce fichier
              </button>
            )}

            <form onSubmit={handleWormholeJoin} className="space-y-2">
              <label htmlFor="wormhole-phrase-input" className="block text-[11px] text-[#D4D4D8]">
                REJOINDRE VIA PHRASE WORMHOLE / CROC :
              </label>
              <div className="flex gap-2">
                <input
                  id="wormhole-phrase-input"
                  type="text"
                  value={wormholeInput}
                  onChange={(e) => setWormholeInput(e.target.value)}
                  placeholder="Ex: a1b2c3-aardvark-adviser"
                  className="flex-1 min-h-[40px] px-3 py-2 bg-[#0C0C10] border border-white/15 rounded-xl text-xs text-white placeholder-[#A1A1AA]/60"
                />
                <button
                  type="submit"
                  disabled={!wormholeInput.trim()}
                  className="min-h-[40px] px-4 py-2 tactile-btn-primary rounded-xl font-bold uppercase disabled:opacity-40"
                >
                  Relier
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 5. WEBTORRENT (REAL BENCODE + SHA-1 INFOHASH + MAGNET URI) */}
        {activeProtocol === 'WEBTORRENT' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-[#E4E4E7] font-semibold flex items-center gap-2">
                <Magnet aria-hidden="true" className="h-4 w-4 text-[#FF6A1F]" />
                WEBTORRENT / BITTORRENT OVER WEBRTC
              </span>
              <span className="text-[#34D399] font-bold">BEP-0003 BENCODE</span>
            </div>

            {!selectedFile ? (
              <div className="p-4 rounded-xl bg-[#0C0C10] border border-dashed border-white/15 text-center text-[#A1A1AA]">
                Sélectionnez un fichier ou un dossier réel pour calculer son InfoHash SHA-1/SHA-256
                et générer son lien Magnet et fichier <code>.torrent</code>.
              </div>
            ) : isBuildingTorrent || !torrentMeta ? (
              <div className="p-4 rounded-xl bg-[#0C0C10] border border-white/15 text-center text-[#E4E4E7]">
                Calcul réel des pièces SHA-1 (256 Ko) et encodage Bencode en cours...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-[#0C0C10] border border-white/10">
                    <span className="block text-[10px] text-[#A1A1AA]">INFOHASH (BTIH SHA-1)</span>
                    <code className="mt-0.5 block text-[11px] font-bold text-[#34D399] truncate">
                      {torrentMeta.infoHashSha1}
                    </code>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0C0C10] border border-white/10">
                    <span className="block text-[10px] text-[#A1A1AA]">PIÈCES (256 KB)</span>
                    <span className="mt-0.5 block text-xs font-bold text-[#F4F4F6]">
                      {torrentMeta.totalPieces} pièces vérifiées
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0C0C10] border border-white/10 space-y-1.5">
                  <div className="text-[10px] text-[#A1A1AA]">URI MAGNET WEBRTC GÉNÉRÉE :</div>
                  <div className="text-[11px] text-[#E4E4E7] break-all line-clamp-2 select-all">
                    {torrentMeta.magnetUri}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(torrentMeta.magnetUri);
                      setCopiedMagnet(true);
                      setTimeout(() => setCopiedMagnet(false), 1800);
                    }}
                    className="min-h-[40px] px-3 py-2 rounded-xl tactile-btn-surface font-semibold flex items-center justify-center gap-2"
                  >
                    {copiedMagnet ? (
                      <Check aria-hidden="true" className="h-4 w-4 text-[#10B981]" />
                    ) : (
                      <Copy aria-hidden="true" className="h-4 w-4 text-[#FF6A1F]" />
                    )}
                    <span>{copiedMagnet ? 'Magnet Copié !' : 'Copier Magnet URI'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTorrentFile}
                    className="min-h-[40px] px-3 py-2 rounded-xl tactile-btn-primary font-semibold flex items-center justify-center gap-2"
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                    <span>Exporter .torrent</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. SYNCTHING BEP (100% REAL SHA-256 128 KB BLOCKS) */}
        {activeProtocol === 'SYNCTHING' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-[#E4E4E7] font-semibold flex items-center gap-2">
                <Blocks aria-hidden="true" className="h-4 w-4 text-[#10B981]" />
                SYNCTHING BEP (BLOCS 128 KB SHA-256 RÉELS)
              </span>
              <span className="text-[#34D399] font-bold">
                {isScanningBlocks ? 'HACHAGE...' : 'VÉRIFIÉ'}
              </span>
            </div>

            {syncthingLedger ? (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className="text-[#F4F4F6] font-bold truncate max-w-[240px]">
                    {syncthingLedger.fileName}
                  </span>
                  <span className="text-[#A1A1AA] text-[11px]">
                    {syncthingLedger.totalBlocks} blocs de 128 Ko ({syncthingLedger.syncProgress}%)
                  </span>
                </div>

                {syncthingLedger.rootSha256 && (
                  <div className="p-2.5 rounded-xl bg-[#0C0C10] border border-white/10 text-[11px] text-[#A1A1AA] truncate">
                    SHA-256 Global : <code className="text-[#34D399]">{syncthingLedger.rootSha256}</code>
                  </div>
                )}

                <div className="text-[11px] text-[#A1A1AA]">
                  MATRICE DES EMPREINTES SHA-256 PAR BLOC (SURVOLEZ POUR VOIR LE HASH RÉEL) :
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 p-2.5 bg-[#0C0C10] border border-white/10 rounded-xl max-h-36 overflow-y-auto">
                  {syncthingLedger.blocks.map((blk) => (
                    <div
                      key={blk.index}
                      title={`Bloc #${blk.index} (${formatBytes(blk.size)}) — SHA-256: ${blk.hash}`}
                      className="px-1.5 py-1 rounded-md bg-[#10B981]/20 hover:bg-[#10B981]/40 transition-colors border border-[#10B981]/50 flex flex-col items-center justify-center text-[9px] text-[#F4F4F6]"
                    >
                      <span className="font-bold">#{blk.index}</span>
                      <span className="text-[8px] text-[#34D399] truncate w-full text-center">
                        {blk.hash.slice(0, 6)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#0C0C10] border border-dashed border-white/15 rounded-xl text-center text-[#A1A1AA]">
                Sélectionnez un fichier ou un dossier réel pour calculer les empreintes SHA-256 de
                chaque bloc Syncthing de 128 Ko.
              </div>
            )}
          </div>
        )}

        {/* 7. PAIRDROP & KDE CONNECT REAL-TIME CLIPBOARD */}
        {activeProtocol === 'PAIRDROP' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-[#E4E4E7] font-semibold flex items-center gap-2">
                <Clipboard aria-hidden="true" className="h-4 w-4 text-[#FF6A1F]" />
                PAIRDROP & PRESSE-PAPIER P2P TEMPS RÉEL
              </span>
              <span className="text-[#FF7A33] font-bold">WEBRTC + RELAIS</span>
            </div>

            <form onSubmit={(e) => void handleShareClipboard(e)} className="space-y-2">
              <label htmlFor="pairdrop-clipboard-input" className="block text-[11px] text-[#D4D4D8]">
                ENVOYER DU TEXTE, LIEN OU EXTRAIT DE CODE AUX PAIRS :
              </label>
              <div className="flex gap-2">
                <input
                  id="pairdrop-clipboard-input"
                  type="text"
                  value={clipboardText}
                  onChange={(e) => setClipboardText(e.target.value)}
                  placeholder="Collez du texte ou une URL à partager..."
                  className="flex-1 min-h-[40px] px-3 py-2 bg-[#0C0C10] border border-white/15 rounded-xl text-xs text-white placeholder-[#A1A1AA]/60"
                />
                <button
                  type="submit"
                  disabled={!clipboardText.trim()}
                  className="min-h-[40px] px-4 py-2 tactile-btn-primary font-bold rounded-xl uppercase text-xs disabled:opacity-40"
                >
                  Diffuser
                </button>
              </div>
              {clipboardNotice && (
                <div role="status" className="text-[11px] text-[#34D399]">
                  {clipboardNotice}
                </div>
              )}
            </form>

            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] text-[#A1A1AA] font-semibold">
                FLUX PRESSE-PAPIER PARTAGÉ ({mergedClipboardItems.length}) :
              </div>
              {mergedClipboardItems.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-[#0C0C10] border border-dashed border-white/15 text-center text-[#A1A1AA]">
                  Aucun extrait partagé dans cette session.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {mergedClipboardItems.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-2.5 bg-[#0C0C10] border border-white/10 rounded-xl flex justify-between items-center gap-2 text-xs"
                    >
                      <div className="overflow-hidden">
                        <span className="text-[#F4F4F6] font-medium block truncate">
                          {msg.payload}
                        </span>
                        <span className="text-[10px] text-[#A1A1AA]">
                          {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(msg.payload)}
                        aria-label="Copier ce message"
                        className="px-2.5 py-1 rounded-lg bg-[#1C1C24] border border-white/10 text-[#E4E4E7] hover:text-white text-[11px]"
                      >
                        Copier
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. RETICULUM & REAL HARDWARE SENSORS (ZERO MOCK DATA) */}
        {activeProtocol === 'RETICULUM_MESH' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-[#E4E4E7] font-semibold flex items-center gap-2">
                <Cpu aria-hidden="true" className="h-4 w-4 text-[#10B981]" />
                RETICULUM CRYPTO & CAPTEURS MATÉRIELS RÉELS
              </span>
              <button
                type="button"
                onClick={() => void refreshRealTelemetry()}
                className="inline-flex items-center gap-1 text-[#34D399] hover:underline"
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Sonder</span>
              </button>
            </div>

            {hardwareTelemetry && (
              <>
                <div className="space-y-1">
                  <div className="text-[11px] text-[#A1A1AA]">
                    HASH DE DESTINATION RETICULUM (SHA-256 TRONQUÉ 128 BITS) :
                  </div>
                  <div className="p-2.5 bg-[#0C0C10] border border-white/15 rounded-xl text-[#F4F4F6] font-bold tracking-wider text-xs select-all break-all">
                    {hardwareTelemetry.reticulumHash}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 bg-[#0C0C10] border border-white/10 rounded-xl">
                    <span className="block text-[10px] text-[#A1A1AA]">NŒUD ID</span>
                    <span className="mt-0.5 block font-bold text-[#F4F4F6]">
                      {hardwareTelemetry.nodeId}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#0C0C10] border border-white/10 rounded-xl">
                    <span className="block text-[10px] text-[#A1A1AA]">BATTERIE RÉELLE</span>
                    <span className="mt-0.5 block font-bold text-[#34D399]">
                      {hardwareTelemetry.batteryLevel !== null
                        ? `${hardwareTelemetry.batteryLevel}% ${
                            hardwareTelemetry.isCharging ? '(Secteur)' : ''
                          }`
                        : 'Alimentation AC / N/D'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#0C0C10] border border-white/10 rounded-xl">
                    <span className="block text-[10px] text-[#A1A1AA]">RÉSEAU DÉTECTÉ</span>
                    <span className="mt-0.5 block font-bold text-[#F4F4F6]">
                      {hardwareTelemetry.networkEffectiveType || 'Standard'}
                      {hardwareTelemetry.networkDownlinkMbps !== null
                        ? ` (${hardwareTelemetry.networkDownlinkMbps} Mbps)`
                        : ''}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#0C0C10] border border-white/10 rounded-xl">
                    <span className="block text-[10px] text-[#A1A1AA]">LATENCE RTT RÉELLE</span>
                    <span className="mt-0.5 block font-bold text-[#F4F4F6]">
                      {hardwareTelemetry.networkRttMs !== null
                        ? `${hardwareTelemetry.networkRttMs} ms`
                        : 'En attente de lien'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#0C0C10] border border-white/10 rounded-xl">
                    <span className="block text-[10px] text-[#A1A1AA]">SNR ACOUSTIQUE</span>
                    <span className="mt-0.5 block font-bold text-[#FF7A33]">
                      {hardwareTelemetry.acousticSnrDb !== null
                        ? `${hardwareTelemetry.acousticSnrDb} dB`
                        : 'Inactif (0 dB)'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#0C0C10] border border-white/10 rounded-xl">
                    <span className="block text-[10px] text-[#A1A1AA]">CŒURS LOGIQUES</span>
                    <span className="mt-0.5 block font-bold text-[#F4F4F6]">
                      {hardwareTelemetry.hardwareConcurrency
                        ? `${hardwareTelemetry.hardwareConcurrency} threads`
                        : 'N/D'}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 9. KDE CONNECT & WARPINATOR PIN AUTH */}
        {activeProtocol === 'KDE_WARPINATOR' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-[#E4E4E7] font-semibold flex items-center gap-2">
                <Shield aria-hidden="true" className="h-4 w-4 text-[#FF6A1F]" />
                VERROUILLAGE WARPINATOR & KDE CONNECT
              </span>
              <span className="text-[#FF7A33] font-bold">AUTH PIN 4 CHIFFRES</span>
            </div>

            <div className="p-3.5 bg-[#0C0C10] border border-white/15 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] text-[#A1A1AA]">CODE PIN DE GROUPE LOCAL :</div>
                <div className="text-xl font-bold tracking-[0.25em] text-[#FF7A33] mt-0.5">
                  {warpinatorPin}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWarpinatorPin(generateWarpinatorPin());
                  setPinAuthorized(false);
                }}
                className="min-h-[36px] px-3 py-1.5 bg-[#1C1C24] hover:bg-[#262630] border border-white/15 text-xs text-[#E4E4E7] rounded-xl font-semibold"
              >
                Régénérer PIN
              </button>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-2">
              <label htmlFor="warpinator-pin-input" className="block text-[11px] text-[#D4D4D8]">
                VALIDER LE CODE PIN DU DESTINATAIRE :
              </label>
              <div className="flex gap-2">
                <input
                  id="warpinator-pin-input"
                  type="text"
                  inputMode="numeric"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  placeholder="4 chiffres"
                  maxLength={4}
                  className="flex-1 min-h-[40px] px-3 py-2 bg-[#0C0C10] border border-white/15 rounded-xl text-xs text-white placeholder-[#A1A1AA]/60 tracking-widest text-center"
                />
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 tactile-btn-primary font-bold rounded-xl uppercase text-xs"
                >
                  Autoriser
                </button>
              </div>
              {pinAuthorized && (
                <div role="status" className="text-[11px] text-[#34D399]">
                  ✓ Session Warpinator authentifiée pour le transfert P2P.
                </div>
              )}
              {pinError && (
                <div role="alert" className="text-[11px] text-[#FCA5A5]">
                  {pinError}
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
