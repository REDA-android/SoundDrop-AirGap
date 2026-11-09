# SoundDrop v5.0 — Unified Open-Source P2P & Multi-Protocol File Transfer Hub

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/REDA-android/SoundDrop-AirGap)

SoundDrop v5.0 is an end-to-end encrypted, zero-mock multi-protocol file and directory transfer platform built with **Next.js 14 (App Router & Edge Runtime)**, **WebRTC Direct DataChannels**, **WebAudio DSP (GGWave 4-FSK)**, **WebCrypto (ECDH P-256 / AES-256-GCM / PBKDF2)**, and the **File System Access API**.

---

## Strict Engineering Guarantees (`@[user_global]`)

1. **Zero Mock Data (`NO MOCK DATA`)**:
   - No synthetic arrays, fake peer nodes, fake battery percentages, or simulated `Math.random()` hashes exist anywhere in the codebase.
   - Every metric, SHA-256 block digest, InfoHash, audio spectrum bar, and hardware telemetry field is computed live from real files and real browser/OS APIs.
2. **Mandatory Empty State (`MANDATORY EMPTY STATE`)**:
   - The application boots into an explicit **Empty State** (`0 fichiers · 0 octets · 0 dossiers`) waiting for the user to select local files or inspect a local folder.
3. **Real Local Directory Access (`window.showDirectoryPicker` + `webkitdirectory` Fallback)**:
   - Native folder selection via `window.showDirectoryPicker()` recursively scans the selected directory, computes real file/subfolder counts, extension distributions, and SHA-256 digests, and packages an on-the-fly ZIP bundle (`fflate`).
   - Full fallback via `<input type="file" webkitdirectory multiple>` guarantees universal browser compatibility.

---

## 10 Integrated Open-Source Protocols

| # | Protocol Engine | Module | Key Capabilities |
| :- | :--- | :--- | :--- |
| 1 | **Acoustic FSK (`ggwave`)** | [`lib/audio/FskModulator.ts`](lib/audio/FskModulator.ts), [`FskDemodulator.ts`](lib/audio/FskDemodulator.ts) | 4-FSK Ultrasonic & Audible air-gapped modulation (`48000 Hz`), Reed-Solomon `GF(256)` ECC, live `AnalyserNode` FFT TX/RX spectrum |
| 2 | **WebRTC Direct (`PairDrop / ShareDrop`)** | [`lib/webrtc/PeerConnection.ts`](lib/webrtc/PeerConnection.ts), [`signaling.ts`](lib/webrtc/signaling.ts) | Race-free ICE candidate queueing, `BroadcastChannel` `<5ms` local signaling, SSE/HTTP room signaling, SCTP 64 KB backpressure |
| 3 | **OpenDrop (`AirDrop OWL`)** | [`lib/opendrop/OpenDropClient.ts`](lib/opendrop/OpenDropClient.ts), [`app/api/opendrop/upload/route.ts`](app/api/opendrop/upload/route.ts) | AWDL/OWL peer discovery, `/ask` handshake acknowledgement, chunked binary `/upload` (`Content-Range`) and receiver download |
| 4 | **LocalSend v2.1 REST** | [`lib/protocols/localsend.ts`](lib/protocols/localsend.ts), [`app/api/localsend/v2/upload/route.ts`](app/api/localsend/v2/upload/route.ts) | Real SHA-256 certificate fingerprint, peer announce (`BroadcastChannel` + Edge), binary upload & one-click receiver download |
| 5 | **Magic-Wormhole / Croc PAKE** | [`lib/protocols/wormhole-webtorrent.ts`](lib/protocols/wormhole-webtorrent.ts) | Deterministic PGP-word code phrases (`7-guitarist-revenge-ABCD`) mapped to signaling rooms with WebCrypto `PBKDF2-HMAC-SHA256` verification |
| 6 | **WebTorrent (`Magnet / Bencode`)** | [`lib/protocols/wormhole-webtorrent.ts`](lib/protocols/wormhole-webtorrent.ts) | Real Bencode encoder, piece-level SHA-1 & SHA-256 InfoHash calculation, `magnet:?xt=urn:btih:...` URI & downloadable `.torrent` file |
| 7 | **Syncthing BEP v1.27** | [`lib/protocols/syncthing.ts`](lib/protocols/syncthing.ts) | Real 128 KB block slicing and real WebCrypto `SHA-256` digest calculation per block + real-time peer block-exchange announcements |
| 8 | **Reticulum / Meshtastic** | [`lib/protocols/reticulum-mesh.ts`](lib/protocols/reticulum-mesh.ts) | Real WebCrypto SHA-256 node identity (`128-bit`), real `navigator.getBattery()`, `navigator.connection` RTT/downlink, and acoustic SNR |
| 9 | **QR Optical Fountain (`txqr`)** | [`lib/protocols/qr-fountain.ts`](lib/protocols/qr-fountain.ts) | Luby Transform (LT) rateless erasure-coded optical frames for air-gapped screen-to-camera file streaming |
| 10 | **Shared Room Clipboard** | [`app/api/signal/[...action]/route.ts`](app/api/signal/%5B...action%5D/route.ts) | Instant text/snippet synchronization over WebRTC DataChannel (`PacketType.CLIPBOARD_MSG`) + room HTTP relay |

---

## Architecture & Conductor Documentation

- **C4 Architecture**:
  - [Level 1 — System Context](C4-Documentation/c4-context.md)
  - [Level 2 — Container View](C4-Documentation/c4-container.md)
  - [Level 3 — Component View](C4-Documentation/c4-component.md)
  - [OpenAPI 3.1 Specification](C4-Documentation/apis/sounddrop-api.yaml)
- **Conductor Control Plane**:
  - [Conductor Index](conductor/index.md)

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in two tabs or devices to test real directory analysis, WebRTC direct transfer, OpenDrop, LocalSend v2.1, Magic-Wormhole phrases, WebTorrent `.torrent` generation, and Acoustic FSK.
