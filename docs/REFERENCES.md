# REGISTRE DES DÉPÔTS ET RÉFÉRENCES TECHNIQUES (50 DÉPÔTS)

> **Statut : Références techniques et documentaires (Phase 8)**  
> Ce registre sert de documentation pour les implémentations natives et de recherche. Aucun code GPL n'est copié dans le projet web. Les crates Rust et bibliothèques C++ sont gérées séparément dans le projet natif.

---

## 1. Modems Acoustiques & Audio DSP
1. **ggwave** (`ggerganov/ggwave`) — MIT — Base du modem acoustique FSK multi-tons et Reed-Solomon WebAssembly.
2. **libquiet** (`quiet/quiet`) — BSD-3 — Référence modem logiciel acoustique.
3. **minimodem** (`kamalmostafa/minimodem`) — GPL-3 — *Lecture seule*, aucune copie de code.
4. **liquid-dsp** (`jgaeddert/liquid-dsp`) — MIT — DSP logiciel, filtres et synchronisation de phase.
5. **pocketfft** (`mreineck/pocketfft`) — BSD-3 — FFT rapide en C++.
6. **RustFFT** (`ejmahler/RustFFT`) — MIT/Apache-2.0 — Bibliothèque FFT performante en Rust pur.
7. **biquad-rs** (`korken89/biquad-rs`) — MIT/Apache-2.0 — Filtres biquad IIR.
8. **fundsp** (`SamiPerttu/fundsp`) — MIT/Apache-2.0 — Synthèse audio procédurale.

---

## 2. Audio I/O Natif
9. **cpal** (`RustAudio/cpal`) — Apache-2.0 — Entrée/sortie audio multiplateforme en Rust.
10. **rodio** (`RustAudio/rodio`) — MIT/Apache-2.0 — Lecture audio Rust.
11. **miniaudio** (`mackron/miniaudio`) — Public Domain / MIT — Moteur audio portable.
12. **portaudio** (`PortAudio/portaudio`) — MIT — Audio I/O temps réel.
13. **oboe** (`google/oboe`) — Apache-2.0 — Audio haute performance sous Android (AAudio/OpenSL ES).

---

## 3. Codes Correcteurs, Compression & Aperçu
14. **reed-solomon-erasure** (`darrenldl/reed-solomon-erasure`) — MIT — Encodage d'effacement Reed-Solomon en Rust.
15. **zstd** (`facebook/zstd`) — BSD-3/GPL-2 — Algorithme de compression rapide pour petits payloads.
16. **brotli** (`google/brotli`) — MIT — Compression générique.
17. **blurhash** (`woltapp/blurhash`) — MIT — Génération et décodage de miniatures floues ultra-compactes (20-30 caractères).

---

## 4. Cryptographie & Sécurité
18. **AEADs** (`RustCrypto/AEADs`) — MIT/Apache-2.0 — Chiffrement authentifié ChaCha20-Poly1305.
19. **x25519-dalek** (`dalek-cryptography/x25519-dalek`) — BSD-3 — Échange de clés Diffie-Hellman sur Curve25519.
20. **tweetnacl-js** (`dchest/tweetnacl-js`) — Public Domain — Primitives cryptographiques pour l'application web.
21. **ring** (`briansmith/ring`) — ISC / OpenSSL / MIT — Cryptographie sécurisée.
22. **age** (`FiloSottile/age`) — BSD-3 — Outil et bibliothèque de chiffrement de fichiers moderne.

---

## 5. UI Native & Rendu GPU
23. **slint** (`slint-ui/slint`) — GPLv3 / Commerciale gratuite — Interface graphique native GPU réactive.
24. **egui** (`emilk/egui`) — MIT/Apache-2.0 — Interface graphique immédiate (immediate mode).
25. **imgui** (`ocornut/imgui`) — MIT — Dear ImGui C++.
26. **femtovg** (`femtovg/femtovg`) — MIT/Apache-2.0 — Rendu vectoriel 2D accéléré GPU.
27. **tiny-skia** (`RazrFalcon/tiny-skia`) — BSD-3 — Moteur de rendu vectoriel 2D logiciel.
28. **cosmic-text** (`pop-os/cosmic-text`) — Apache-2.0 — Mise en page et rendu de texte international (dont RTL / Arabe).
29. **accesskit** (`AccessKit/accesskit`) — MIT/Apache-2.0 — Accessibilité et lecteurs d'écran natifs.

---

## 6. Moteurs Physiques 2D
30. **rapier** (`dimforge/rapier`) — Apache-2.0 — Physique 2D/3D déterministe en Rust.
31. **box2d** (`erincatto/box2d`) — MIT — Moteur physique 2D C++.
32. **Chipmunk2D** (`slembcke/Chipmunk2D`) — MIT — Moteur physique 2D rapide en C.
