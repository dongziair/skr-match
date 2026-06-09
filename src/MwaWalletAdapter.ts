/**
 * MwaWalletAdapter - A WalletAdapter that uses the native MWA Capacitor plugin.
 * This adapter bridges the native Solana Mobile Wallet Adapter protocol
 * to the standard @solana/wallet-adapter-base interface.
 *
 * Used to connect Seeker Wallet and other MWA-compatible wallets on Solana Mobile devices.
 */

import {
  BaseWalletAdapter,
  WalletAdapterNetwork,
  WalletConnectionError,
  WalletNotConnectedError,
  WalletNotReadyError,
  WalletPublicKeyError,
  WalletReadyState,
  WalletSignMessageError,
  WalletSignTransactionError,
  WalletSendTransactionError,
  type WalletName,
  type SendTransactionOptions,
} from '@solana/wallet-adapter-base';
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  type TransactionSignature,
} from '@solana/web3.js';
import {
  isMwaAvailable,
  mwaAuthorize,
  mwaSignTransaction,
  mwaSignMessage,
  mwaDeauthorize,
} from './NativeMwaBridge';
import { Capacitor } from '@capacitor/core';

export const MwaBridgeWalletName = 'MwaBridge' as WalletName<'MwaBridge'>;

export interface MwaBridgeWalletAdapterConfig {
  network?: WalletAdapterNetwork;
}

export class MwaBridgeWalletAdapter extends BaseWalletAdapter {
  name = MwaBridgeWalletName;
  url = 'https://skr-match.app';
  icon = '/favicon.svg';
  readonly supportedTransactionVersions = null;

  private _publicKey: PublicKey | null = null;
  private _readyState: WalletReadyState;
  private _connected = false;
  private _authToken: string | null = null;

  constructor(config: MwaBridgeWalletAdapterConfig = {}) {
    super();
    this._readyState = Capacitor.isNativePlatform()
      ? WalletReadyState.Installed
      : WalletReadyState.Unsupported;

    this._verifyAvailability();
  }

  get publicKey(): PublicKey | null {
    return this._publicKey;
  }

  get readyState(): WalletReadyState {
    return this._readyState;
  }

  get connected(): boolean {
    return this._connected;
  }

  get connecting(): boolean {
    return false;
  }

  private async _verifyAvailability(): Promise<void> {
    try {
      const available = await isMwaAvailable();
      const newReadyState = available
        ? WalletReadyState.Installed
        : WalletReadyState.Unsupported;
      if (newReadyState !== this._readyState) {
        this._readyState = newReadyState;
        this.emit('readyStateChange', this._readyState);
      }
    } catch {
      if (this._readyState !== WalletReadyState.Unsupported) {
        this._readyState = WalletReadyState.Unsupported;
        this.emit('readyStateChange', this._readyState);
      }
    }
  }

  async connect(): Promise<void> {
    try {
      if (this._connected || this.connecting) return;

      if (this._readyState === WalletReadyState.Unsupported) {
        throw new WalletNotReadyError('MWA is not available on this device');
      }

      const { publicKey: pubKeyStr, authToken } = await mwaAuthorize();

      let publicKey: PublicKey;
      try {
        publicKey = new PublicKey(pubKeyStr);
      } catch {
        throw new WalletPublicKeyError(`Invalid public key from MWA: ${pubKeyStr}`);
      }

      this._publicKey = publicKey;
      this._authToken = authToken;
      this._connected = true;

      this.emit('connect', publicKey);
    } catch (error: any) {
      this.emit('error', error);
      throw new WalletConnectionError(error?.message || 'MWA connection failed', error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await mwaDeauthorize();
    } catch {
      // Ignore deauth errors
    }

    if (this._publicKey) {
      this._publicKey = null;
      this._authToken = null;
      this._connected = false;
      this.emit('disconnect');
    }
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (!this._connected || !this._publicKey) {
      throw new WalletNotConnectedError();
    }

    try {
      const serialized = transaction.serialize();
      const signedBytes = await mwaSignTransaction(serialized);

      if (transaction instanceof VersionedTransaction) {
        return VersionedTransaction.deserialize(signedBytes) as T;
      } else {
        return Transaction.from(signedBytes) as T;
      }
    } catch (error: any) {
      this.emit('error', error);
      throw new WalletSignTransactionError(error?.message || 'MWA sign transaction failed', error);
    }
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options: SendTransactionOptions = {}
  ): Promise<TransactionSignature> {
    if (!this._connected || !this._publicKey) {
      throw new WalletNotConnectedError();
    }

    try {
      const signedTx = await this.signTransaction(transaction);
      const { signers, ...sendOptions } = options;

      if (signedTx instanceof Transaction && signers && signers.length > 0) {
        signedTx.partialSign(...signers);
      }

      const rawTransaction = signedTx.serialize();
      return await connection.sendRawTransaction(rawTransaction, sendOptions);
    } catch (error: any) {
      this.emit('error', error);
      throw new WalletSendTransactionError(error?.message || 'MWA send transaction failed', error);
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this._connected || !this._publicKey) {
      throw new WalletNotConnectedError();
    }

    try {
      return await mwaSignMessage(message);
    } catch (error: any) {
      this.emit('error', error);
      throw new WalletSignMessageError(error?.message || 'MWA sign message failed', error);
    }
  }
}
