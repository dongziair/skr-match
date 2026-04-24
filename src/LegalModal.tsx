import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ShieldCheck, Trash2, X, Mail, FileText, Loader2 } from 'lucide-react';
import {
  clearLocalPlayerData,
  deletePlayerDataWithSignature,
  getDeleteDataMessage,
} from './ProgressStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SUPPORT_EMAIL = 'support@skr-match.app';

export default function LegalModal({ visible, onClose }: Props) {
  const { publicKey, disconnect, signMessage } = useWallet();
  const [deleting, setDeleting] = useState(false);
  const walletAddress = publicKey?.toBase58() ?? '';

  if (!visible) return null;

  const handleClearLocal = () => {
    clearLocalPlayerData(walletAddress || undefined);
    onClose();
    window.location.reload();
  };

  const handleDeleteData = async () => {
    if (!walletAddress || deleting) return;
    const confirmed = window.confirm(
      'Delete your SKR Match server profile and local game data? On-chain transactions cannot be deleted.',
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      if (!signMessage) {
        throw new Error('Wallet does not support message signing');
      }
      const signature = await signMessage(
        new TextEncoder().encode(getDeleteDataMessage(walletAddress)),
      );
      await deletePlayerDataWithSignature(walletAddress, signature);
      await disconnect();
      window.location.reload();
    } catch (error) {
      setDeleting(false);
      const message = error instanceof Error ? error.message : 'Could not delete server data';
      window.alert(`${message}. Please contact support if this continues.`);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[390px] rounded-3xl p-5 animate-modal-pop"
        style={{
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,14,26,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,255,170,0.05)',
        }}
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-[#00ffaa]/10 border border-[#00ffaa]/20">
              <ShieldCheck size={20} className="text-[#00ffaa]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#e0e6f0]">Privacy & Safety</h2>
              <p className="text-xs text-[#64748b] mt-0.5">SKR Match compliance center</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#475569] hover:text-white hover:bg-white/10 transition"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="py-4 space-y-3 text-sm text-[#94a3b8] leading-relaxed">
          <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2 text-[#e0e6f0] font-bold mb-2">
              <FileText size={15} className="text-[#00ffaa]" />
              Privacy Policy
            </div>
            <p>
              SKR Match uses your public Solana wallet address, game progress,
              leaderboard name, inventory, and daily bonus timestamp to run the
              game. We do not collect seed phrases, private keys, real names,
              phone numbers, payment cards, precise location, or health data.
            </p>
            <p className="mt-2">
              On-chain transactions are public and cannot be deleted by SKR Match.
              Server profile data and local game data can be deleted below.
            </p>
          </div>

          <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2 text-[#e0e6f0] font-bold mb-2">
              <Mail size={15} className="text-[#38bdf8]" />
              Support
            </div>
            <p>
              Report privacy, safety, leaderboard, or transaction concerns at{' '}
              <a className="text-[#38bdf8] underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </div>

          <div className="rounded-2xl p-4 bg-[#ef4444]/5 border border-[#ef4444]/15">
            <div className="flex items-center gap-2 text-[#fecaca] font-bold mb-2">
              <Trash2 size={15} />
              Delete Data
            </div>
            <p>
              Deletion removes your server profile and local device data for this
              wallet. It does not erase public Solana blockchain history.
            </p>
            <div className="grid grid-cols-1 gap-2 mt-3">
              <button
                onClick={handleDeleteData}
                disabled={!walletAddress || deleting}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#fecaca] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete Wallet Data
              </button>
              <button
                onClick={handleClearLocal}
                className="rounded-xl px-4 py-3 bg-white/[0.04] border border-white/[0.08] text-[#e0e6f0] font-bold"
              >
                Clear Local Data Only
              </button>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-[#475569] text-center">
          Last updated April 24, 2026
        </p>
      </div>
    </div>
  );
}
