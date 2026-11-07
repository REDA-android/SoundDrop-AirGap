# SOUND DROP NATIVE: 50 PROJETS OPEN SOURCE & ARCHITECTURE D'INTÉGRATION POLYGLOTE
## Spécification d'Intégration Bas Niveau (Rust, C++20, Go, Python 3.12, R, Ruby) — Zero-HTML / Zero-JS / Zero-CSS

Ce catalogue officiel détaille les 50 dépôts open source (sans aucun doublon) constituant l'infrastructure matérielle, DSP, cryptographique, cinétique et opérationnelle de **Sound Drop**.

---

### Catégorie 1 : Audio Hardware Direct, ALSA, CoreAudio, WASAPI (Rust / C / C++)

| # | Projet & Dépôt | Langage | Rôle dans Sound Drop | Point d'Entrée & Interface d'Intégration |
|:-:|:---|:---:|:---|:---|
| 1 | [cpal](https://github.com/RustAudio/cpal) | Rust | Capture et restitution audio multi-plateforme bas niveau | `sound-drop/dsp-engine/src/audio_io.rs` via `cpal::traits::DeviceTrait` |
| 2 | [miniaudio](https://github.com/mackron/miniaudio) | C | Moteur audio natif en un seul fichier header sans runtime externe | FFI C/Rust pour la restitution directe sans allocation mémoire |
| 3 | [rodio](https://github.com/RustAudio/rodio) | Rust | Lecture audio native et gestion de sources en mémoire vive | Synthèse des pings de découverte et chimes d'acquittement ToF |
| 4 | [portaudio](https://github.com/PortAudio/portaudio) | C | Interfaces audio matérielles temps réel en mode exclusif | Pilote de secours WASAPI Exclusive RAW & ALSA `hw:0,0` |
| 5 | [oboe](https://github.com/google/oboe) | C++ | Audio ultra-faible latence pour cibles mobiles / Android | Pipeline AAudio / OpenSL ES natif avec bypass des filtres vocaux |

---

### Catégorie 2 : Algorithmes DSP, Filtrage Numérique & Mathématiques Vectorielles (C++20 / Rust)

| # | Projet & Dépôt | Langage | Rôle dans Sound Drop | Point d'Entrée & Interface d'Intégration |
|:-:|:---|:---:|:---|:---|
| 6 | [biquad](https://github.com/korken89/biquad-rs) | Rust | Filtres biquadratiques pour passe-bande analogiques simulés | Isolation de la bande ultrasonique 17.5–20.5 kHz et audible 1.2–4.8 kHz |
| 7 | [pocketfft](https://github.com/mreineck/pocketfft) | C++ | Transformée de Fourier rapide C++ ultra-légère | Analyse spectrale continue et vérification de phase baseband |
| 8 | [liquid-dsp](https://github.com/jgaeddert/liquid-dsp) | C | Boîte à outils SDR pour communications logicielles | Démodulation multi-porteuse FSK et synchronisation de trame |
| 9 | [microfft](https://github.com/bendikro/microfft-rs) | Rust | FFT sans allocation dynamique pour environnements contraints | Calcul du plancher de bruit (Noise Floor) et rapport SNR temps réel |
| 10 | [signalment / dsp-chain](https://github.com/RustAudio/dsp-chain) | Rust | Traitement en pipeline et chaînage de signaux numériques | Pipeline séquentiel: AGC -> Biquad -> Goertzel -> PLL Doppler |
| 11 | [Aquila](https://github.com/zsiciarz/aquila) | C++ | Bibliothèque DSP C++ pour extraction de caractéristiques | Détection automatique des harmoniques de transitoires acoustiques |
| 12 | [dsp-filters](https://github.com/vinniefalco/DSPFilters) | C++ | Filtres numériques Butterworth, Chebyshev et Elliptiques | Réjection d'encoche raide (notch filter) à 50/60 Hz et 8 kHz |

---

### Catégorie 3 : Interfaces Graphiques Natives Rust & C++ (Zero-HTML / Zero-CSS / Zero-DOM)

| # | Projet & Dépôt | Langage | Rôle dans Sound Drop | Point d'Entrée & Interface d'Intégration |
|:-:|:---|:---:|:---|:---|
| 13 | [slint](https://github.com/slint-ui/slint) | Rust/C++ | Interface graphique compilée native GPU sans DOM ni navigateur | `sound-drop/native-gui/ui/sound_drop.slint` + `main.rs` |
| 14 | [egui](https://github.com/emilk/egui) | Rust | GUI en mode immédiat ultra-rapide sur OpenGL/Vulkan | Affichage de débogage télémétrique et oscilloscopes vectoriels |
| 15 | [imgui](https://github.com/ocornut/imgui) | C++ | Dear ImGui pour instruments d'inspection acoustique temps réel | Panneau de calibrage DSP et monitoring des registres AVX2 |
| 16 | [femtovg](https://github.com/adamreichold/femtovg) | Rust | Moteur de dessin vectoriel 2D accéléré GPU (OpenGL) | Rendu des ondes de choc circulaires et auras cinétiques |
| 17 | [tiny-skia](https://github.com/RazrFalcon/tiny-skia) | Rust | Rasterizer 2D logiciel complet et minimaliste sans dépendances C | Dessin sub-pixel des vecteurs Hairline 0.5px et biseaux métalliques |
| 18 | [cosmic-text](https://github.com/pop-os/cosmic-text) | Rust | Moteur typographique natif ultra-précis | Affichage sub-pixel des métriques ToF, SNR et fréquences en Hz |

---

### Catégorie 4 : IPC, Concurrence & Réseau Air-Gap Bas Niveau (Go / Rust / C)

| # | Projet & Dépôt | Langage | Rôle dans Sound Drop | Point d'Entrée & Interface d'Intégration |
|:-:|:---|:---:|:---|:---|
| 19 | [watermill](https://github.com/ThreeDotsLabs/watermill) | Go | Gestion d'événements et de messages concurrents par canaux | Orchestration asynchrone des flux d'émission et de réception |
| 20 | [nhooyr/websocket](https://github.com/nhooyr/websocket) | Go | Transport socket local ultra-léger sans CGO | Pont IPC bidirectionnel entre le démon Go et le moteur de rendu |
| 21 | [nanomsg](https://github.com/nanomsg/nanomsg) | C | Communication par sockets légères inter-processus (Pipeline, Pair) | Tuyaux IPC à mémoire partagée entre C++ AVX2 et Go |
| 22 | [zenoh](https://github.com/eclipse-zenoh/zenoh) | Rust | Échange de données sans courtier pour environnements contraints | Diffusion locale pair-à-pair sur réseau ad-hoc local |
| 23 | [gopacket](https://github.com/google/gopacket) | Go | Manipulation de paquets et framing bas niveau | Structuration des trames acoustiques FEC RS(80,64) et encapsulation |

---

### Catégorie 5 : Cryptographie Pure & Échanges Sécurisés Hors-Réseau (Rust / Go / Python)

| # | Projet & Dépôt | Langage | Rôle dans Sound Drop | Point d'Entrée & Interface d'Intégration |
|:-:|:---|:---:|:---|:---|
| 24 | [ring](https://github.com/briansmith/ring) | Rust | Moteur cryptographique Assembleur/Rust (X25519, ChaCha20-Poly1305) | Chiffrement éphémère de session et signature des défis ToF |
| 25 | [noise-protocol](https://github.com/plizon/noiseprotocol) | Python | Framework de protocoles cryptographiques sécurisés point-à-point | Implémentation du handshake acoustique Noise_XX |
| 26 | [cryptography](https://github.com/pyca/cryptography) | Python | Primitives de chiffrement symétrique et scellement Curve25519 | Scellement cryptographique des métadonnées de fichiers |
| 27 | [ed25519-dalek](https://github.com/dalek-cryptography/ed25519-dalek) | Rust | Signatures cryptographiques rapides résistantes aux canaux auxiliaires | Signature des Nonces ToF 32 bits et validation d'intégrité |
| 28 | [age](https://github.com/FiloSottile/age) | Go | Chiffrement moderne de fichiers sans dépendances complexes | Chiffrement des charges utiles de fichiers avant découpage en paquets |

---

### Catégorie 6 : Compression & Compactage Binaire Avancé (Rust / C / Python)

| # | Projet & Dépôt | Langage | Rôle dans Sound Drop | Point d'Entrée & Interface d'Intégration |
|:-:|:---|:---:|:---|:---|
| 29 | [zstd](https://github.com/facebook/zstd) | C | Algorithme Zstandard à haute vitesse et fort ratio | Compactage initial des fichiers et payloads binaires |
| 30 | [snap](https://github.com/BurntSushi/rust-snappy) | Rust | Compression Snappy ultra-rapide sans allocation | Compression temps réel des flux audio bruts et trames ToF |
| 31 | [heatshrink](https://github.com/armink/heatshrink) | C | Compresseur pour environnements contraints à mémoire microscopique | Compression des paquets d'identification balise (4 octets) |
| 32 | [brotli](https://github.com/google/brotli) | C/Rust | Compression générique optimisée pour les formats textuels | Compactage des textes et métadonnées JSON de partage |
| 33 | [miniz_oxide](https://github.com/Frommi/miniz_oxide) | Rust | Port Rust pur de miniz pour compression Deflate sans dépendance C | Création de conteneurs ZIP à la volée pour répertoires |

---

### Catégorie 7 : Analyse Numérique, Télémétrie & Modélisation (R & Python)

| # | Projet & Dépôt | Langage | Rôle dans Sound Drop | Point d'Entrée & Interface d'Intégration |
|:-:|:---|:---:|:---|:---|
| 34 | [seewave](https://github.com/cran/seewave) | R | Boîte à outils de référence pour l'analyse et la synthèse sonore | Modélisation spectrale 3D et caractérisation de la réponse en fréquence |
| 35 | [tuneR](https://github.com/cran/tuneR) | R | Analyse des séries temporelles audio et extraction fréquentielle | `sound-drop/telemetry-lab/tof_analysis.R` pour l'analyse statistique ToF |
| 36 | [phonTools](https://github.com/cran/phonTools) | R | Traitement des formants et analyse spectrale avancée | `sound-drop/telemetry-lab/psd_telemetry.R` pour l'estimation PSD Doppler |
| 37 | [scipy](https://github.com/scipy/scipy) | Python | Modules `scipy.signal` pour conception de filtres analogiques | Calcul des polynômes Reed-Solomon et simulations acoustiques |
| 38 | [numpy](https://github.com/numpy/numpy) | Python | Calcul matriciel vectoriel optimisé | Prétraitement et normalisation des flux d'échantillons audio |

---

### Catégorie 8 : Automatisation, CLI & Systèmes de Fichiers (Ruby)

| # | Projet & Dépôt | Langage | Rôle dans Sound Drop | Point d'Entrée & Interface d'Intégration |
|:-:|:---|:---:|:---|:---|
| 39 | [tty-prompt](https://github.com/piotrmurach/tty-prompt) | Ruby | Interface en ligne de commande interactive et stylisée | Sélection interactive du mode (TX, RX, Data Diode) dans `sounddrop_ctl` |
| 40 | [gli](https://github.com/davetron5000/gli) | Ruby | Framework d'applications CLI complexes structurées | Définition des sous-commandes de pilotage et diagnostics de transmission |
| 41 | [ffi](https://github.com/ffi/ffi) | Ruby | Liaison dynamique directe avec les fonctions C/Rust | Appel direct des bibliothèques compilées depuis la console d'administration |
| 42 | [rake](https://github.com/ruby/rake) | Ruby | Gestionnaire de compilation et orchestration des tâches multi-langages | `sound-drop/cli-ops/Rakefile` pour la compilation et les tests unifiés |

---

### Catégorie 9 : Modélisation Physique 2D & Moteurs Dynamiques Natifs (C++ / Rust / C)

| # | Projet & Dépôt | Langage | Rôle dans Sound Drop | Point d'Entrée & Interface d'Intégration |
|:-:|:---|:---:|:---|:---|
| 43 | [Box2D](https://github.com/erincatto/box2d) | C++ | Moteur physique rigide 2D de référence | Simulation des chocs élastiques et des répulsions des bulles de pairs |
| 44 | [rapier](https://github.com/dimforge/rapier) | Rust | Moteur physique 2D déterministe écrit en Rust pur | Intégration physique native dans le GPU context sans overhead C |
| 45 | [salva](https://github.com/dimforge/salva) | Rust | Simulateur de fluides 2D SPH | Modélisation de la déformation liquide des bulles sous pression acoustique |
| 46 | [chipmunk2d](https://github.com/slembcke/Chipmunk2D) | C | Moteur physique 2D rapide et léger en C pur | Alternative ultra-compacte pour les architectures embarquées |

---

### Catégorie 10 : Émulation Locale & Moteurs d'Exécution Conteneurisés (Go)

| # | Projet & Dépôt | Langage | Rôle dans Sound Drop | Point d'Entrée & Interface d'Intégration |
|:-:|:---|:---:|:---|:---|
| 47 | [wazero](https://github.com/tetratelabs/wazero) | Go | Runtime WebAssembly pur sans CGO | Exécution 100% hors-ligne de modules WASM dans le démon Go |
| 48 | [boltdb](https://github.com/boltdb/bolt) | Go | Base de données clé-valeur intégrée sur disque | Persistance des blocs de paquets reçus et reprise sur coupure |
| 49 | [badger](https://github.com/dgraph-io/badger) | Go | Stockage LSM ultra-performant pour SSD/NVMe | Journalisation haute vitesse des événements de télémétrie ToF et ARQ |
| 50 | [bubbletea](https://github.com/charmbracelet/bubbletea) | Go | Architecture TUI basée sur The Elm Architecture | Console TUI native de surveillance acoustique en mode terminal pur |

---

### Architecture Globale du Pipeline

```
[ Matériel Audio / Micro ]
           │
           ▼
[ CoreAudio / WASAPI Exclusive RAW / ALSA hw:0,0 ]  (Bypass filtres OS)
           │
           ▼
[ LockFreeAudioRingBuffer (Rust) ] (Zero-malloc, barrières atomiques)
           │
           ├──▶ [ Banc Goertzel AVX2 / NEON (C++20) ] ──▶ Détection 8 tons simultanés (_mm256_fmadd_ps)
           ├──▶ [ PLL Doppler 16 kHz ]               ──▶ Compensation instantanée Δf
           └──▶ [ ToF Engine & Nonce Guard ]         ──▶ Validation distance < 1.50m (t < 4.37ms)
                                                             │ (Si replay détecté : Verrou diode 2000ms)
                                                             ▼
                                                [ Slint GPU Native UI ]
                                                ├── Hairline 0.5px & Metalforge
                                                ├── Kinetics Colorion (Mesh 4 Pôles)
                                                ├── Bulles Micro-Physique (k=240, c=18.5)
                                                ├── Morphicons (64 points Bézier)
                                                └── Page-Mascot (Matrice 6 états)
```
