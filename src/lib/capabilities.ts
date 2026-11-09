export type Status = 'real' | 'experimental' | 'planned';

export interface Capability {
  id: string;
  label: string;
  status: Status;
  /** Chemin du test automatisé qui prouve la fonction (obligatoire si status = 'real'). */
  verifiedBy?: string;
}

export const CAPABILITIES: Capability[] = [
  { id: 'acoustic-audible', label: 'Transfert sonore audible', status: 'real', verifiedBy: 'src/lib/modem/modem.test.ts' },
  { id: 'acoustic-ultrasonic', label: 'Transfert ultrasonique', status: 'experimental' },
  { id: 'text-transfer', label: 'Envoi de texte / URL', status: 'real', verifiedBy: 'src/lib/protocol/protocol.test.ts' },
  { id: 'file-transfer', label: 'Envoi de petits fichiers', status: 'planned' },
  { id: 'encryption', label: 'Chiffrement de bout en bout', status: 'planned' },
  { id: 'sas-pairing', label: 'Vérification par code court (SAS)', status: 'planned' },
  { id: 'webrtc-lan', label: 'WebRTC réseau local', status: 'experimental' },
  { id: 'pwa-offline', label: 'Utilisation hors ligne', status: 'planned' },
];

export const byId = (id: string): Capability | undefined => CAPABILITIES.find((c) => c.id === id);
