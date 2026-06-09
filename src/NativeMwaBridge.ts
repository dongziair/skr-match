// Capacitor plugin interface for Solana Mobile Wallet Adapter.
import { registerPlugin, Capacitor } from '@capacitor/core';

export interface MwaBridgePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  authorize(): Promise<{ publicKey: string; authToken: string; walletUri: string }>;
  signTransaction(options: { transaction: string }): Promise<{ signedTransaction: string }>;
  signMessage(options: { message: string }): Promise<{ signedMessage: string }>;
  deauthorize(): Promise<{ success: boolean }>;
}

const MwaBridge = registerPlugin<MwaBridgePlugin>('MwaBridge');

/**
 * Check if the device supports MWA (has a wallet app installed that handles solana-wallet://)
 */
export async function isMwaAvailable(): Promise<boolean> {
  try {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    const { available } = await MwaBridge.isAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Authorize with an MWA-compatible wallet (e.g. Seeker Wallet).
 * Returns the wallet public key as a base58 string.
 */
export async function mwaAuthorize(): Promise<{ publicKey: string; authToken: string }> {
  const result = await MwaBridge.authorize();
  return {
    publicKey: result.publicKey,
    authToken: result.authToken,
  };
}

/**
 * Sign a serialized Solana transaction via MWA.
 * Takes a Uint8Array of the serialized transaction, returns the signed Uint8Array.
 */
export async function mwaSignTransaction(serializedTx: Uint8Array): Promise<Uint8Array> {
  const txBase64 = uint8ArrayToBase64(serializedTx);
  const result = await MwaBridge.signTransaction({ transaction: txBase64 });
  return base64ToUint8Array(result.signedTransaction);
}

/**
 * Sign an arbitrary message via MWA.
 */
export async function mwaSignMessage(messageBytes: Uint8Array): Promise<Uint8Array> {
  const msgBase64 = uint8ArrayToBase64(messageBytes);
  const result = await MwaBridge.signMessage({ message: msgBase64 });
  return base64ToUint8Array(result.signedMessage);
}

/**
 * Deauthorize the current MWA session.
 */
export async function mwaDeauthorize(): Promise<void> {
  await MwaBridge.deauthorize();
}

// Helpers

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
