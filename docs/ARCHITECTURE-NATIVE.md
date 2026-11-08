# ARCHITECTURE NATIVE & DESIGN SYSTEM SOUNDDROP

> **Statut : Document de conception (hors chemin critique de l'application web)**  
> Ce document décrit les spécifications et concepts prévus pour les implémentations natives (Rust, Slint, mobile) de SoundDrop. Il a été extrait de l'interface web afin de garantir l'honnêteté et la légèreté de l'application déployée.

---

## 1. Principes Fondamentaux de la Version Native
1. **Zéro allocation sur le thread audio** : capture et restitution sans malloc ni locks via ring-buffer sans verrou (`rtrb`).
2. **Interface native GPU** : moteur graphique Slint avec shaders vectoriels légers (tiny-skia / femtovg / opengl).
3. **Mascotte vectorielle réactive** : oscillateur physique harmonique du 2nd ordre modélisant les micro-interactions ($m\ddot{x} + c\dot{x} + kx = F(t)$).
4. **Physique des bulles** : intégration du moteur de collisions Rapier2D à 60 FPS.
5. **Couche DSP & Modem** :
   - Phase 1 : `ggwave` (C++ via bindings FFI) pour émission/réception immédiate et robuste.
   - Phase 2 : MFSK 16 tons avec démodulation Goertzel native 48 kHz.
   - Preamble chirp linéaire (1,5 kHz $\to$ 5,5 kHz) avec corrélation croisée FFT pour synchronisation et absorption de la dérive d'horloge.
6. **Vérification de proximité** : Short Authentication String (SAS) à 6 chiffres avec protocole Commit-Reveal sur clés éphémères X25519 / HKDF-SHA256.

---

## 2. Diode Matérielle vs Réception Seule Logicielle
- **Réception Seule Logicielle** : l'application n'ouvre aucun flux audio de sortie (`AudioContext` en mode capture pure).
- **Diode Matérielle** : câble jack/adaptateur physique sans canal haut-parleur.
- **Note de sécurité** : le mode diode matérielle n'autorisant aucune émission acoustique en retour, il est incompatible avec le protocole interactif SAS (qui nécessite un échange bidirectionnel). Il s'appuie donc sur un secret partagé pré-établi (phrase de passe + Argon2id).
