import WalletContextProvider from './WalletContextProvider';
import SkrGate from './SkrGate';
import Navbar from './Navbar';
import GameBoard from './GameBoard';
import BgMusic from './BgMusic';

function App() {
  return (
    <WalletContextProvider>
      <SkrGate>
        <div className="w-full min-h-[100dvh] bg-[#0a0e1a] text-[#e0e6f0] flex justify-center cyber-grid-bg">
          {/* 手机比例容器 */}
          <div
            className="w-full max-w-[420px] min-h-[100dvh] flex flex-col relative"
            style={{
              background: 'linear-gradient(180deg, rgba(10,14,26,0.95) 0%, rgba(15,23,42,0.98) 100%)',
              boxShadow: '0 0 60px rgba(0,255,170,0.03)',
            }}
          >
            <Navbar />
            <div className="flex-1 flex flex-col min-h-0">
              <GameBoard />
            </div>
          </div>
        </div>
      </SkrGate>
    </WalletContextProvider>
  );
}

export default App;
