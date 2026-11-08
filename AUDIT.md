# SoundDrop AirGap — Audit initiale (Web v1)

**Date :** 2026-11-08  
**Branche :** `repair/web-v1`  
**Base auditée :** `main` — `677d66cca252a7700aeeb2971838e0d3ed7df832`  
**Projet Vercel :** `sound-drop-air-gap` (Next.js)  
**Périmètre :** application web Next.js déployée sur Vercel. Le client natif Rust/Slint est une cible distincte et n'est pas considéré comme une fonctionnalité web.

## Résumé exécutif

Le dépôt contient une vraie base de travail : interface Next.js, modulation/démodulation audio, WebRTC DataChannels, transfert par blocs et endpoints de signalisation. En revanche, plusieurs promesses affichées ne correspondent pas au comportement démontré par le code. Les risques prioritaires concernent le mode acoustique direct, la persistance de la signalisation et l'exposition des salons/presse-papiers.

Le dernier déploiement de production est marqué **READY** et provient bien de `REDA-android/SoundDrop-AirGap`, branche `main`, commit `677d66c`. Cela confirme le déploiement, pas la fiabilité fonctionnelle des transferts.

## Constats

### [P1] Le transfert acoustique direct tronque les fichiers et bascule sur WebRTC

- `src/lib/webrtc/offline-sdp.ts:121-125` encode uniquement `file.slice(0, 96)`.
- `src/app/page.tsx:323-339` bascule automatiquement vers `startTransmitter()` pour les fichiers de plus de 96 octets. Ce chemin crée une session WebRTC et utilise la signalisation.
- Pour les fichiers de 96 octets ou moins, le mode direct envoie le préfixe encodé, sans vérifier que le fichier entier a été transmis.
- Dans le chemin de réception acoustique direct (`src/app/page.tsx`, callback de `FskDemodulator`), le SHA-256 est calculé sur les octets reçus puis l'état de vérification est défini à `true`. Ce calcul seul ne compare pas les données reçues à une empreinte attendue par l'émetteur.

**Impact :** le bouton/chemin présenté comme transfert de fichier « 100 % Air-Gap » ne transfère pas un fichier complet de façon générale. Le statut « vérifié » peut être trompeur pour ce chemin.

**Correction proposée :** distinguer clairement « envoi acoustique de code/appairage » et « transfert de fichier via réseau ». Ne jamais afficher « fichier envoyé » ou « SHA-256 vérifié » sans longueur complète et comparaison avec l'empreinte annoncée par l'émetteur. Pour un véritable transfert acoustique, implémenter fragmentation, numérotation, reprise, contrôle d'intégrité et tests sur deux appareils.

### [P1] La signalisation WebRTC repose sur une mémoire locale au processus serveur

- `src/app/api/signal/[...action]/route.ts:32-43` stocke salons et presse-papiers dans des `Map` attachées à `globalThis`.
- Le code expire les salons après dix minutes (`cleanExpiredRooms`, lignes 46-54).
- Sur une plateforme serverless, cette mémoire n'est ni un stockage durable ni un registre partagé garanti entre instances. Une requête suivante peut atteindre une autre instance ou une instance froide.

**Impact :** les deux appareils peuvent ne pas voir le même salon ou perdre l'état de signalisation, même si chaque requête répond correctement.

**Correction proposée :** choisir un stockage partagé et durable compatible Vercel (Redis/KV ou base de données), ajouter TTL explicite et tests multi-instance. Tant que ce n'est pas fait, présenter la signalisation serveur comme expérimentale.

### [P1] Les endpoints de salons et de presse-papiers ne montrent pas de contrôle d'accès

- `src/app/api/signal/[...action]/route.ts` expose une lecture des salons actifs via l'action GET `rooms`.
- L'action GET `clipboard` retourne les derniers messages du flux global si aucun salon n'est spécifié.
- L'action POST `clipboard` ajoute un message au flux global et accepte un champ `encrypted` qui est seulement stocké comme booléen ; ce champ ne chiffre pas le contenu.

**Impact :** si ces endpoints sont accessibles publiquement dans le déploiement, les codes de salons et les messages du presse-papiers global peuvent être visibles ou modifiables par des tiers. Le booléen `encrypted` ne doit pas être présenté comme une protection cryptographique.

**Correction proposée :** supprimer le flux global par défaut, exiger un jeton de session fort pour chaque salon, appliquer une autorisation côté serveur, limiter taille/fréquence des requêtes et ne jamais considérer un indicateur `encrypted` comme un chiffrement.

### [P2] Les garanties de qualité ne sont pas vérifiées automatiquement

- `package.json` ne définit pas de script `test` ni de suite de tests.
- `next.config.mjs` contient `eslint.ignoreDuringBuilds: true` : le build peut réussir sans que les erreurs ESLint bloquent le déploiement.
- Le déploiement Vercel `READY` prouve qu'un build a été publié, pas que l'audio fonctionne sur iOS/Android ni que les transferts entre deux appareils aboutissent.

**Correction proposée :** ajouter des tests unitaires pour framing/CRC, tests d'intégration pour le protocole DataChannel, contrôle TypeScript/lint en CI et une matrice de tests manuels iPhone Safari ↔ Android Chrome.

### [P2] Le composant RX présente une étape comme une barre de progression

- `src/components/audio/AcousticReceiver.tsx` calcule la largeur de la barre à partir de `stateCode / 4`.
- `stateCode` représente l'état du décodeur (préambule, échantillonnage, validation, etc.), pas le pourcentage d'un transfert.

**Correction proposée :** remplacer la barre par un indicateur d'étape clairement nommé, ou la relier à une progression mesurée réelle.

### [P2] Le nom « 10 protocoles » dépasse ce que l'interface déclare

- `src/components/transfer/MultiProtocolPanel.tsx:49-98` déclare neuf identifiants d'onglets (`UnifiedProtocol`) et neuf entrées dans `PROTOCOL_TABS`.
- Plusieurs onglets exécutent des opérations locales ou des métadonnées propres à l'application ; cela ne prouve pas une interopérabilité complète avec les logiciels/protocoles originaux.

**Correction proposée :** afficher le nombre exact de fonctions réellement opérationnelles et distinguer « compatible/inter-opérable », « expérimental » et « outil local ». Ne pas revendiquer une compatibilité protocolaire sans tests croisés avec les implémentations de référence.

## Décision d'architecture

1. **Web v1 seulement :** Next.js + Web Audio + WebRTC. Ne pas mélanger les sources Rust/Slint dans le périmètre de réparation web.
2. **Un chemin de transfert principal :** d'abord stabiliser WebRTC DataChannel sur réseau local, avec signalisation documentée.
3. **Audio en étape séparée :** commencer par un appairage acoustique fiable ; ne pas présenter l'audio comme transport de fichiers complets tant que la fragmentation et la récupération ne sont pas testées.
4. **Sécurité avant les fonctionnalités :** isoler les salons, supprimer le presse-papiers global public, et comparer les empreintes calculées à une empreinte attendue.
5. **Pas de fausses métriques :** aucune progression, distance, vitesse, SNR ou validation ne doit être affichée sans mesure réelle.

## Plan de réparation proposé

- **Phase 0 — Audit :** ce document uniquement. Aucun code applicatif modifié.
- **Phase 1 — Honnêteté de l'interface :** corriger les libellés et statuts trompeurs.
- **Phase 2 — Transfert WebRTC :** sécuriser/persister la signalisation et valider l'envoi/réception de fichiers avec checksum comparé.
- **Phase 3 — Audio :** tests de modulation/démodulation sur appareils réels, puis fragmentation et reprise si le transfert acoustique complet est maintenu.
- **Phase 4 — Compatibilité :** iPhone Safari, Android Chrome, permissions micro, reprise après interruption et mode hors ligne.
- **Phase 5 — CI :** tests, lint et build bloquants avant fusion.

## Limites de cet audit

Cet audit est une revue statique du code et des métadonnées de déploiement. Aucun transfert physique entre deux appareils, test de microphone, test de charge, test multi-instance Vercel ou audit cryptographique complet n'a encore été exécuté. Les constats ci-dessus doivent être validés par des tests avant toute affirmation de correction.
