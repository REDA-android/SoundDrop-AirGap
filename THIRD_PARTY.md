# GESTION DES DÉPENDANCES TIERCES (THIRD_PARTY.md)

Ce fichier consigne toute dépendance ajoutée au projet web avec sa justification, sa licence et son impact.
Règle : Aucune dépendance ajoutée sans justification. Aucun code GPL copié dans le code source.

---

## 1. Dépendances de Développement Ajoutées

### `vitest` (v2.1.8)
- **Licence** : MIT
- **Taille** : ~36 paquets dans `node_modules` (dev uniquement, 0 octet dans le bundle de production).
- **Rôle** : Exécuteur de tests unitaires et d'intégration rapide en mémoire pour l'application web (Phase 1 : `capabilities.test.ts`, Phase 3 : tests modems, Phase 4 : CRC et protocoles, Phase 5 : crypto et SAS).
- **Maintenance** : Maintenu activement par l'équipe Vite / Vitest (standard de l'écosystème JS/TS moderne).

---

## 2. Dépendances de Production Clés Existantes
- **`ggwave` (0.4.0)** : MIT. Modem acoustique multi-tons et Reed-Solomon WebAssembly.
- **`tweetnacl` (1.0.3)** : Public Domain. Primitives cryptographiques légères pour le chiffrement E2EE et les paires de clés.
- **`blurhash` (2.0.5)** : MIT. Encodeur / décodeur de miniatures compactes pour aperçu avant transfert.
- **`next` (14.2.15)** : MIT. Framework React SSR / SSG.
- **`framer-motion` (14.10.1)** : MIT. Animations d'interface.
- **`lucide-react` (0.453.0)** : ISC. Icônes d'interface.
