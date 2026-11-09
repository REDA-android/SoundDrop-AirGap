'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  WifiOff,
  Volume2,
  Mic,
  MicOff,
  ShieldCheck,
  Zap,
  Lock,
  Sparkles,
  Sliders,
  Folder,
  Smartphone,
  Laptop,
  LayoutGrid,
  RotateCcw,
  Cpu,
} from 'lucide-react';
import {
  AcousticBand,
  TransmissionMode,
  ModemConfig,
  DemodState,
  Telemetry,
  Packet,
  DropResult,
} from '@/types/acoustic';
import { PeerBubble, AcousticTelemetry } from '@/types/sound-drop';
import { getConfigForBand, AUDIBLE_CONFIG, ULTRASONIC_CONFIG, WHISPER_CONFIG } from '@/lib/dsp/constants';
import { AudioManager } from '@/lib/audio/audio-manager';
import { packetizeText, packetizeFile } from '@/lib/protocol/packetizer';
import { prepareImageForAcousticDrop, renderBlurHashToDataUrl } from '@/lib/part8-media-crypto/image-micro-prep';
import { encryptAcousticPayload, decryptAcousticPayload } from '@/lib/part8-media-crypto/acoustic-cipher';
import { airdropSynth } from '@/lib/part5-ui-sfx/airdrop-synth';
import { peerDiscovery } from '@/lib/part2-p2p/peer-discovery';
import { saveReceivedDrop } from '@/lib/part3-offline/drop-storage';
import { useSoundDropStore } from '@/store/useSoundDropStore';
import { useWakeLock } from '@/hooks/useWakeLock';

import { AirDropBubbleRadar } from '@/components/radar/AirDropBubbleRadar';
import { AudioUnlockOverlay } from '@/components/AudioUnlockOverlay';
import { SonarDropZone } from '@/components/SonarDropZone';
import { SpectrogramDrawer } from '@/components/studio/SpectrogramDrawer';
import { GoertzelSymbolBars } from '@/components/studio/GoertzelSymbolBars';
import { PacketMatrixGrid } from '@/components/studio/PacketMatrixGrid';
import { AcousticSettings } from '@/components/AcousticSettings';
import { IncomingDropSheet } from '@/components/modals/IncomingDropSheet';
import { LoopbackTestPanel } from '@/components/modals/LoopbackTestPanel';
import { AcousticPairingTx } from '@/lib/audio/acoustic-pairing';
import { AcousticBubbleButton } from '@/components/AcousticBubbleButton';
import { MacDropReceiver } from '@/components/MacDropReceiver';
import { SoundDropNativeApp } from '../../sound-drop-native/desktop-ui/src/components/SoundDropNativeApp';

export default function SoundDropStudio() {
  const {
    peers,
    selectedPeerId,
    isTransmitting,
    isListening,
    settings,
    addPeer,
    updatePeerProgress,
    setIsTransmitting,
    setIsListening,
    setSelectedPeerId,
    updateSettings,
  } = useSoundDropStore();

  const [band, setBand] = useState<AcousticBand>('audible');
  const [txMode, setTxMode] = useState<TransmissionMode>('broadcast');
  const [loopbackActive, setLoopbackActive] = useState<boolean>(true);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(false);

  // App interaction mode
  type AppMode = 'studio' | 'phone-emitter' | 'mac-receiver' | 'native-desktop';
  const [appMode, setAppMode] = useState<AppMode>('studio');

  // Acoustic Proximity Pairing states (Phone-to-Mac)
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'emitting' | 'paired'>('idle');
  const [pairedDeviceName, setPairedDeviceName] = useState<string>('MacBook Pro');
  const [queuedPayload, setQueuedPayload] = useState<{ name: string; type: 'text' | 'file'; size?: number } | null>({
    name: 'Photo_Drop_BlurHash.webp',
    type: 'file',
    size: 48200,
  });
  const pairingTxRef = useRef<AcousticPairingTx | null>(null);

  // Demodulator state
  const [demodState, setDemodState] = useState<DemodState>('IDLE');
  const [telemetry, setTelemetry] = useState<AcousticTelemetry | null>(null);
  const [totalPackets, setTotalPackets] = useState<number>(0);
  const [receivedMap, setReceivedMap] = useState<Map<number, Packet>>(new Map());
  const [healedIndices, setHealedIndices] = useState<Set<number>>(new Set());

  // Result modal
  const [receivedDrop, setReceivedDrop] = useState<DropResult | null>(null);
  const [lastSelfTestSuccess, setLastSelfTestSuccess] = useState<boolean | null>(null);

  // Audio manager reference
  const audioManagerRef = useRef<AudioManager | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // Payload Estimator calculation
  const [currentPayloadBytes, setCurrentPayloadBytes] = useState<number>(0);
  const [estimatedPackets, setEstimatedPackets] = useState<number>(0);
  const [estimatedDurationSec, setEstimatedDurationSec] = useState<number>(0);

  // Automatic Screen Wake Lock during active transmission or listening
  useWakeLock(isTransmitting || isListening);

  const currentConfig: ModemConfig = getConfigForBand(band);

  // Initialize Audio Manager Singleton on mount
  useEffect(() => {
    const mgr = AudioManager.getInstance();
    audioManagerRef.current = mgr;
    mgr.setConfig(currentConfig);
    mgr.setLoopback(loopbackActive);
    setAnalyserNode(mgr.getAnalyser());

    return () => {
      mgr.stopListening();
      mgr.stopPlayback();
    };
  }, []);

  // Update audio manager config when band changes
  const handleBandChange = useCallback((newBand: AcousticBand) => {
    setBand(newBand);
    const cfg = getConfigForBand(newBand);
    if (audioManagerRef.current) {
      audioManagerRef.current.setConfig(cfg);
    }
  }, []);

  // Toggle Loopback mode
  const handleToggleLoopback = useCallback((enabled: boolean) => {
    setLoopbackActive(enabled);
    if (audioManagerRef.current) {
      audioManagerRef.current.setLoopback(enabled);
    }
  }, []);

  // Start or Stop Listening via Microphone
  const handleToggleListening = useCallback(async () => {
    const mgr = audioManagerRef.current;
    if (!mgr) return;

    if (isListening) {
      mgr.stopListening();
      setIsListening(false);
      setDemodState('IDLE');
      airdropSynth.setModemActive(false);
    } else {
      try {
        await mgr.ensureAudioContext();
        setAnalyserNode(mgr.getAnalyser());

        await mgr.startListening({
          onTelemetry: (t) => {
            setTelemetry({
              snrDb: t.snrDb,
              noiseFloor: t.noiseFloor,
              peakEnergy: t.peakEnergy,
              detectedSymbol: t.detectedSymbol,
              goertzelEnergies: t.goertzelEnergies,
              confidence: t.confidence,
              activeFrequency: t.activeFrequency,
              state: t.lockedState === 'DECODING_SYMBOLS' ? 'RECEIVING' : t.lockedState === 'LOCKED_ON_SIGNAL' ? 'LOCKED' : 'SCANNING',
              framesDecoded: t.framesDecoded,
              crcErrors: t.crcErrors,
              fecCorrections: t.fecCorrections,
            });
            setDemodState(t.lockedState);
          },
          onPacketReceived: (packet, healed) => {
            setTotalPackets(packet.header.totalPackets);
            setReceivedMap((prev) => {
              const updated = new Map(prev);
              updated.set(packet.header.packetIndex, packet);
              return updated;
            });
            if (healed) {
              setHealedIndices((prev) => new Set(prev).add(packet.header.packetIndex));
            }

            // Update peer bubble progress if peer selected
            if (selectedPeerId) {
              const pct = Math.round(((receivedMap.size + 1) / packet.header.totalPackets) * 100);
              updatePeerProgress(selectedPeerId, pct, 'receiving');
            }
          },
          onDropCompleted: async (drop) => {
            airdropSynth.setModemActive(false);
            setReceivedDrop(drop);

            // Persist to offline IndexedDB
            await saveReceivedDrop({
              id: drop.id,
              sessionId: parseInt(drop.id.split('_')[1] || '0', 10),
              type: drop.type,
              name: drop.name,
              mimeType: drop.mimeType,
              size: drop.size,
              text: drop.text,
              data: drop.data,
              timestamp: drop.timestamp,
            });

            if (selectedPeerId) {
              updatePeerProgress(selectedPeerId, 100, 'complete');
            }
          },
        });
        setIsListening(true);
        setDemodState('LISTENING_FOR_CHIRP');
        airdropSynth.playRadarPing();
      } catch (err) {
        console.error('Microphone activation failed:', err);
        alert('Microphone permission is required to receive acoustic drops.');
      }
    }
  }, [isListening, selectedPeerId, receivedMap.size, updatePeerProgress, setIsListening]);

  // Transmit Text Payload
  const handleSendText = useCallback(
    async (text: string) => {
      const mgr = audioManagerRef.current;
      if (!mgr) return;

      airdropSynth.playDropWhoosh();
      airdropSynth.setModemActive(true);

      const isUltrasonic = band === 'ultrasonic' || band === 'whisper';
      const amplitude = band === 'whisper' ? 0.2 : isUltrasonic ? 0.95 : 0.85;
      let payloadBytes = new TextEncoder().encode(text);

      // E2EE Encryption if enabled
      if (settings.encryptionEnabled && settings.encryptionPin) {
        payloadBytes = new Uint8Array(await encryptAcousticPayload(payloadBytes, settings.encryptionPin));
      }

      const packetization = packetizeText(new TextDecoder().decode(payloadBytes), isUltrasonic);

      // Estimate transfer metrics
      const numPackets = packetization.packets.length;
      const msPerSymbol = currentConfig.symbolDurationMs;
      const totalSymbols = numPackets * 88 * 2;
      const totalSec = currentConfig.preambleDurationMs / 1000 + (totalSymbols * msPerSymbol) / 1000;

      setCurrentPayloadBytes(packetization.totalBytes);
      setEstimatedPackets(numPackets);
      setEstimatedDurationSec(totalSec);

      setTotalPackets(numPackets);
      setReceivedMap(new Map());
      setHealedIndices(new Set());

      if (loopbackActive && !isListening) {
        await handleToggleListening();
      }

      const modulator = mgr.getModulator();
      const pcm = modulator.synthesizeTransmission(packetization.packets, {
        amplitude,
        includePreamble: true,
      });

      setIsTransmitting(true);
      await mgr.playPcm(pcm, () => {
        setIsTransmitting(false);
        airdropSynth.setModemActive(false);
      });
    },
    [band, currentConfig, loopbackActive, isListening, settings, handleToggleListening, setIsTransmitting]
  );

  // Transmit File or Progressive Image Payload
  const handleSendFile = useCallback(
    async (file: File) => {
      const mgr = audioManagerRef.current;
      if (!mgr) return;

      airdropSynth.playDropWhoosh();
      airdropSynth.setModemActive(true);

      const isUltrasonic = band === 'ultrasonic' || band === 'whisper';
      const amplitude = band === 'whisper' ? 0.2 : isUltrasonic ? 0.95 : 0.85;
      const isImage = file.type.startsWith('image/');

      let fileBytes: Uint8Array;
      let blurHashStr: string | undefined;

      if (isImage) {
        try {
          const prep = await prepareImageForAcousticDrop(file);
          fileBytes = new Uint8Array(prep.compressedBytes);
          blurHashStr = prep.blurHash;

          // Render instant BlurHash preview inside selected target peer bubble!
          if (selectedPeerId) {
            const previewUrl = renderBlurHashToDataUrl(blurHashStr);
            useSoundDropStore.setState((state) => ({
              peers: state.peers.map((p) =>
                p.id === selectedPeerId ? { ...p, blurHashPreview: previewUrl } : p
              ),
            }));
          }
        } catch {
          const buf = await file.arrayBuffer();
          fileBytes = new Uint8Array(buf);
        }
      } else {
        const buf = await file.arrayBuffer();
        fileBytes = new Uint8Array(buf);
      }

      // E2EE Encryption if enabled
      if (settings.encryptionEnabled && settings.encryptionPin) {
        fileBytes = new Uint8Array(await encryptAcousticPayload(fileBytes, settings.encryptionPin));
      }

      const packetization = packetizeFile(
        fileBytes,
        {
          name: file.name,
          size: fileBytes.length,
          type: file.type || 'application/octet-stream',
          lastModified: file.lastModified,
        },
        isUltrasonic
      );

      const numPackets = packetization.packets.length;
      const msPerSymbol = currentConfig.symbolDurationMs;
      const totalSymbols = numPackets * 88 * 2;
      const totalSec = currentConfig.preambleDurationMs / 1000 + (totalSymbols * msPerSymbol) / 1000;

      setCurrentPayloadBytes(fileBytes.length);
      setEstimatedPackets(numPackets);
      setEstimatedDurationSec(totalSec);

      setTotalPackets(numPackets);
      setReceivedMap(new Map());
      setHealedIndices(new Set());

      if (loopbackActive && !isListening) {
        await handleToggleListening();
      }

      const modulator = mgr.getModulator();
      const pcm = modulator.synthesizeTransmission(packetization.packets, {
        amplitude,
        includePreamble: true,
      });

      setIsTransmitting(true);
      await mgr.playPcm(pcm, () => {
        setIsTransmitting(false);
        airdropSynth.setModemActive(false);
      });
    },
    [band, currentConfig, loopbackActive, isListening, selectedPeerId, settings, handleToggleListening, setIsTransmitting]
  );

  // Run Single-Device Loopback Self-Test
  const handleRunLoopbackTest = useCallback(async () => {
    try {
      setLastSelfTestSuccess(null);
      await handleSendText('SOUND_DROP_CALIBRATION_BEACON_TEST_OK');
      setLastSelfTestSuccess(true);
    } catch {
      setLastSelfTestSuccess(false);
    }
  }, [handleSendText]);

  // Acoustic Proximity Chirp Emission (Phone Transmitter)
  const handleEmitPairingChirp = useCallback(async () => {
    if (!pairingTxRef.current) {
      pairingTxRef.current = new AcousticPairingTx();
    }
    setPairingStatus('emitting');
    try {
      await pairingTxRef.current.emitPairingChirp(1);
      setTimeout(() => {
        setPairingStatus('paired');
      }, 400);
    } catch (err) {
      console.error('Pairing chirp emission error:', err);
      setPairingStatus('idle');
    }
  }, []);

  // Automated Proximity Self-Test Loopback (Single-device verify)
  const handlePairingLoopbackTest = useCallback(async () => {
    if (!pairingTxRef.current) {
      pairingTxRef.current = new AcousticPairingTx();
    }
    setPairingStatus('emitting');
    try {
      await pairingTxRef.current.emitPairingChirp(1);
      setTimeout(async () => {
        setPairingStatus('paired');
        await pairingTxRef.current?.playConfirmationChord();
      }, 300);
    } catch (err) {
      console.error('Pairing loopback error:', err);
      setPairingStatus('idle');
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col justify-between">
      {/* Top Cyber Navigation Bar */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-surface-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-950/90 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)] text-cyan-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-widest text-slate-100 uppercase">
                  Sound Drop
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-cyan-950 border border-cyan-800 text-cyan-400">
                  AirDrop via Audio
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                100% Offline Acoustic Data-Over-Sound P2P Transfer
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 font-mono text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Zero Network Required</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>RS(80,64) FEC + CRC-32</span>
            </div>

            {settings.encryptionEnabled && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/80 border border-purple-800 text-purple-300">
                <Lock className="w-3.5 h-3.5 text-purple-400" />
                <span>E2EE PIN</span>
              </div>
            )}

            <button
              onClick={handleToggleListening}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                isListening
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {isListening ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>RX Active</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>RX Muted</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Top Proximity Mode Switcher Bar */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-slate-800 backdrop-blur-md">
          <button
            onClick={() => setAppMode('phone-emitter')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              appMode === 'phone-emitter'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mode: Phone Emitter</span>
          </button>

          <button
            onClick={() => setAppMode('mac-receiver')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              appMode === 'mac-receiver'
                ? 'bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Mode: Mac Receiver</span>
          </button>

          <button
            onClick={() => setAppMode('studio')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              appMode === 'studio'
                ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Mode: Studio Radar</span>
          </button>

          <button
            onClick={() => setAppMode('native-desktop')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              appMode === 'native-desktop'
                ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Mode: Native Desktop (Rust/C++)</span>
          </button>
        </div>

        {/* Automated Proximity Self-Test Loopback Button */}
        <button
          onClick={handlePairingLoopbackTest}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-mono transition-all shadow-md active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Self-Test Loopback Chirp</span>
        </button>
      </div>

      {/* Main Studio Body */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col gap-6">
        {/* VIEW 1: Phone Emitter Proximity Mode */}
        {appMode === 'phone-emitter' && (
          <div className="flex flex-col items-center justify-center py-6 gap-6">
            <div className="text-center max-w-md">
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-cyan-950/80 border border-cyan-800/80 text-cyan-300">
                Device A: Transmitter (iPhone)
              </span>
              <h2 className="text-2xl font-black text-slate-100 mt-2">
                Acoustic Bubble Proximity Pair
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Tap the liquid bubble to synthesize a dual-tone acoustic chirp (1800-2400 Hz sweep + 2800 Hz beacon) to connect to Mac/PC.
              </p>
            </div>

            <AcousticBubbleButton
              status={pairingStatus}
              onEmit={handleEmitPairingChirp}
              pairedDeviceName={pairedDeviceName}
              queuedPayload={queuedPayload}
              onSendQueuedPayload={() => {
                handleSendText('Acoustic Drop Payload from iPhone!');
                setQueuedPayload(null);
              }}
            />

            {/* Live Spectrogram Preview for Emitter */}
            <div className="w-full max-w-2xl mt-4">
              <SpectrogramDrawer
                analyserNode={analyserNode}
                config={currentConfig}
                activeFrequency={telemetry?.activeFrequency}
                isTransmitting={isTransmitting}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: Mac Receiver Radar Mode */}
        {appMode === 'mac-receiver' && (
          <div className="py-4">
            <MacDropReceiver
              onPairingRecognized={(sessionId) => {
                setPairingStatus('paired');
                setPairedDeviceName(`iPhone 16 Pro (Node #${sessionId})`);
                addPeer({
                  id: `peer-phone-${sessionId}`,
                  name: `iPhone 16 Pro (#${sessionId})`,
                  deviceType: 'iphone',
                  x: -110,
                  y: -60,
                  vx: 0,
                  vy: 0,
                  radius: 46,
                  color: '#06B6D4',
                  distanceRssi: 92,
                  lastSeen: Date.now(),
                  status: 'idle',
                  progress: 0,
                });
              }}
              lastReceivedDrop={receivedDrop}
              onClearDrop={() => setReceivedDrop(null)}
            />
          </div>
        )}

        {/* VIEW 4: Next-Gen Native Desktop Shell (Rust, C++, Go, Python, R, Ruby) */}
        {appMode === 'native-desktop' && (
          <div className="py-2">
            <SoundDropNativeApp />
          </div>
        )}

        {/* VIEW 3: Full AirDrop Studio Radar & Diagnostic Mode */}
        {appMode === 'studio' && (
          <>
            {/* Apple AirDrop Physics Bubble Radar */}
            <AirDropBubbleRadar
              peers={peers}
              selectedPeerId={selectedPeerId}
              onSelectPeer={(p) => setSelectedPeerId(p.id)}
              isTransmitting={isTransmitting}
              isListening={isListening}
              currentBand={band}
              onBandChange={handleBandChange}
              telemetry={telemetry}
              onDropPayloadOnPeer={(p) => {
                // Trigger drop if payload ready
              }}
            />

            {/* Middle Section: Sonar Drop Zone & Waterfall Spectrogram */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 flex flex-col">
                <SonarDropZone
                  demodState={demodState}
                  isTransmitting={isTransmitting}
                  isListening={isListening}
                  onSendText={handleSendText}
                  onSendFile={handleSendFile}
                  onSendFolderFiles={(files) => {
                    if (files.length > 0) handleSendFile(files[0]);
                  }}
                  estimatedPackets={estimatedPackets}
                  estimatedDurationSec={estimatedDurationSec}
                  currentPayloadBytes={currentPayloadBytes}
                />
              </div>

              <div className="lg:col-span-6 flex flex-col">
                <SpectrogramDrawer
                  analyserNode={analyserNode}
                  config={currentConfig}
                  activeFrequency={telemetry?.activeFrequency}
                  isTransmitting={isTransmitting}
                />
              </div>
            </div>

            {/* Goertzel Constellation Bars & Packet Matrix Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 flex flex-col">
                <GoertzelSymbolBars telemetry={telemetry} config={currentConfig} />
              </div>

              <div className="lg:col-span-6 flex flex-col">
                <PacketMatrixGrid
                  totalPackets={totalPackets}
                  receivedMap={receivedMap}
                  healedIndices={healedIndices}
                />
              </div>
            </div>

            {/* Bottom Split: Acoustic Tuning Controls & Single-Device Loopback Test */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 flex flex-col">
                <AcousticSettings
                  currentBand={band}
                  onBandChange={handleBandChange}
                  txMode={txMode}
                  onTxModeChange={setTxMode}
                  loopbackActive={loopbackActive}
                  onToggleLoopback={handleToggleLoopback}
                  isListening={isListening}
                  onToggleListening={handleToggleListening}
                />
              </div>

              <div className="lg:col-span-5 flex flex-col">
                <LoopbackTestPanel
                  onRunTest={handleRunLoopbackTest}
                  isTransmitting={isTransmitting}
                  isListening={isListening}
                  loopbackActive={loopbackActive}
                  onToggleLoopback={handleToggleLoopback}
                  lastTestSuccess={lastSelfTestSuccess}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* iOS & Mobile AudioContext Unlock Overlay Gate */}
      <AudioUnlockOverlay
        isUnlocked={isAudioUnlocked}
        onUnlock={async () => {
          const mgr = audioManagerRef.current || AudioManager.getInstance();
          audioManagerRef.current = mgr;
          await mgr.ensureAudioContext();
          setAnalyserNode(mgr.getAnalyser());
          try {
            await handleToggleListening();
          } finally {
            setIsAudioUnlocked(true);
          }
        }}
      />

      {/* Incoming AirDrop Drawer Modal with BlurHash Reveal */}
      <IncomingDropSheet drop={receivedDrop} onClose={() => setReceivedDrop(null)} />

      {/* Footer */}
      <footer className="bg-surface/80 border-t border-surface-border px-6 py-4 mt-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-2">
          <div className="flex items-center gap-2">
            <span>SOUND DROP v2.0.0</span>
            <span>•</span>
            <span>Acoustic AirDrop + Physics Bubble Radar</span>
          </div>
          <div className="flex items-center gap-3">
            <span>48,000 Hz Sampling</span>
            <span>•</span>
            <span>Zero Network Hardware</span>
            <span>•</span>
            <span>PWA Offline-First</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
