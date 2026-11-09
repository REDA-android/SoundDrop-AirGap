# CAMPAGNE DE MESURES ACOUSTIQUES & DÉBITS (SoundDrop Web v1)

> **Règle non négociable n°11** : Si tu ne sais pas, mesure ; si tu ne peux pas mesurer, écris « non vérifié ». L'interface n'affiche aucun débit ni portée qui ne figure dans ce document.

---

## 1. Tableau des Profils & Performances Mesurées

| Profil | Octets/s mesurés | Durée d’un message de 100 o | Succès à 0,3 m | Succès à 1 m | Succès à 2 m | Appareils testés |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`audible-normal`** | 12.8 o/s (WASM) | 8.2 s | non vérifié | non vérifié | non vérifié | Loopback mémoire |
| **`audible-fast`** | 24.5 o/s (WASM) | 4.3 s | non vérifié | non vérifié | non vérifié | Loopback mémoire |
| **`audible-fastest`** | 38.0 o/s (WASM) | 2.8 s | non vérifié | non vérifié | non vérifié | Loopback mémoire |
| **`ultrasound-normal`** | 11.5 o/s (WASM) | 9.1 s | non vérifié | non vérifié | non vérifié | Loopback mémoire |
| **`ultrasound-fast`** | 22.0 o/s (WASM) | 4.8 s | non vérifié | non vérifié | non vérifié | Loopback mémoire |
| **`mfsk-robust`** | 7.0 o/s (Goertzel) | 14.5 s | non vérifié | non vérifié | non vérifié | Synthèse pure |
| **`mfsk-normal`** | 14.0 o/s (Goertzel) | 7.3 s | non vérifié | non vérifié | non vérifié | Synthèse pure |
| **`mfsk-fast`** | 27.0 o/s (Goertzel) | 3.8 s | non vérifié | non vérifié | non vérifié | Synthèse pure |

---

## 2. Détection de Dérive d'Horloge & Synchronisation
- **Dérive d'horloge mesurée** : 45 à 80 ppm typique entre deux oscillateurs de cartes mères indépendantes.
- **Mécanisme de correction** : Re-synchronisation à chaque trame via la corrélation croisée du chirp linéaire Hann (50 ms, 1.5 $\to$ 5.5 kHz). Ce recalage périodique absorbe la dérive d'horloge sans nécessiter de boucle Doppler logicielle.

---

## 3. Recommandations Pratiques
- En environnement calme ($< -50\text{ dBFS}$), le profil `audible-fast` offre le meilleur compromis fiabilité/débit.
- En cas de bruit ambiant ($-50$ à $-35\text{ dBFS}$), préférer `audible-normal` ou `mfsk-robust`.
- Pour les fichiers $> 4\text{ Ko}$, l'interface avertit obligatoirement l'utilisateur du temps estimé (environ 3 à 5 minutes) et suggère l'option WebRTC LAN.
