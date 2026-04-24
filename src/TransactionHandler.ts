import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';

const TREASURY_WALLET = new PublicKey(
  '11111111111111111111111111111111'
);

export const SKR_RECEIVER = new PublicKey(
  '4whoSLX8NsMq5RTuxJaefASFJBk4KTEUTW8nawJRcKRz'
);

const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
);

const RPC_POOL = [
  'https://mainnet.helius-rpc.com/?api-key=0642853f-9302-4b06-9c4e-9993bae91683',
  'https://mainnet.helius-rpc.com/?api-key=b57d78a0-3d73-4ae7-91a3-c727e905ac06',
  'https://mainnet.helius-rpc.com/?api-key=1954f0ce-0852-4268-8775-46c7d9f5f696',
  'https://mainnet.helius-rpc.com/?api-key=f6311c8b-13b0-4593-9f64-629bd3c8b5a9',
];

function getShuffledEndpoints(): string[] {
  return [...RPC_POOL].sort(() => Math.random() - 0.5);
}

const SKR_TO_SOL_RATE = 0.001;

export const POWERUP_PRICES: Record<string, number> = {
  remove3: 3,
  undo: 3,
  shuffle: 3,
};

export async function sendPowerUpPayment(
  connection: Connection,
  publicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  powerUpType: string,
): Promise<string> {
  const skrPrice = POWERUP_PRICES[powerUpType];
  if (!skrPrice) {
    throw new Error(`Unknown power-up type: ${powerUpType}`);
  }

  const lamports = Math.ceil(skrPrice * SKR_TO_SOL_RATE * LAMPORTS_PER_SOL);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: TREASURY_WALLET,
      lamports,
    }),
  );

  transaction.recentBlockhash = blockhash;
  transaction.feePayer = publicKey;

  const signedTx = await signTransaction(transaction);
  const rawTx = signedTx.serialize();
  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  );

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return signature;
}

export async function getWalletBalance(
  connection: Connection,
  publicKey: PublicKey,
): Promise<number> {
  const addr = publicKey.toBase58();

  // 策略 1：通过打乱的 RPC 连接池进行全方位遍历获取，解决单节点限流问题
  const rpcEndpoints = getShuffledEndpoints();

  for (const endpoint of rpcEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [addr, { commitment: 'confirmed' }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        console.warn(`[SKR Match] Balance RPC HTTP ${resp.status} from ${endpoint}`);
        continue;
      }
      const data = await resp.json();
      if (data?.result?.value !== undefined) {
        const sol = data.result.value / LAMPORTS_PER_SOL;
        console.log(`[SKR Match] Balance via fetch ${endpoint}: ${sol} SOL`);
        return sol;
      }
      if (data?.error) {
        console.warn(`[SKR Match] Balance RPC error from ${endpoint}:`, data.error);
      }
    } catch (err) {
      console.warn(`[SKR Match] Balance fetch failed (${endpoint}):`, err);
    }
  }

  // 策略 2：通过 wallet adapter 的 connection（兜底）
  try {
    const balance = await connection.getBalance(publicKey, 'confirmed');
    const sol = balance / LAMPORTS_PER_SOL;
    console.log(`[SKR Match] Balance via connection: ${sol} SOL`);
    return sol;
  } catch (err) {
    console.warn('[SKR Match] Balance via connection failed:', err);
  }

  console.error('[SKR Match] All balance methods failed for', addr);
  return 0;
}

export function isBalanceSufficient(
  balanceSol: number,
  powerUpType: string,
): boolean {
  const skrPrice = POWERUP_PRICES[powerUpType];
  if (!skrPrice) return false;
  const requiredSol = skrPrice * SKR_TO_SOL_RATE;
  return balanceSol >= requiredSol;
}

export const SKR_MINT = new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3');

export async function getSkrBalance(
  connection: Connection,
  publicKey: PublicKey,
): Promise<number> {
  const rpcEndpoints = getShuffledEndpoints();
  
  for (const endpoint of rpcEndpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            publicKey.toBase58(),
            { mint: SKR_MINT.toBase58() },
            { encoding: 'jsonParsed', commitment: 'confirmed' },
          ],
        }),
        signal: AbortSignal.timeout(5000), // 5秒超时则立即切换下一个
      });
      if (!resp.ok) continue;

      const json = await resp.json();
      const accounts = json?.result?.value ?? [];
      if (accounts.length === 0) return 0;
      
      return accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
    } catch (err) {
      console.warn(`[SKR Match] getSkrBalance Fallback skipped (${endpoint}):`, err);
    }
  }

  // 兜底失败返回0
  return 0;
}

export async function getSkrPrice(): Promise<number> {
  try {
    const resp = await fetch(
      `https://price.jup.ag/v6/price?ids=${SKR_MINT.toBase58()}&vsToken=USDC`,
      { signal: AbortSignal.timeout(5000) },
    );
    const json = await resp.json();
    return json?.data?.[SKR_MINT.toBase58()]?.price ?? 0;
  } catch {
    return 0;
  }
}

// 发送 SKR 代币到指定收款地址，并附加链上 Memo 记录
export async function sendSkrPayment(
  connection: Connection,
  publicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  powerUpType: string,
  level: number,
): Promise<string> {
  void level;
  const skrPrice = POWERUP_PRICES[powerUpType];
  if (!skrPrice) throw new Error(`Unknown item type: ${powerUpType}`);

  const decimals = 6;
  const amount = BigInt(skrPrice) * BigInt(10 ** decimals);

  const senderAta = await getAssociatedTokenAddress(SKR_MINT, publicKey);
  const receiverAta = await getAssociatedTokenAddress(SKR_MINT, SKR_RECEIVER);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction();

  const memoText = `SKR Match purchase: ${powerUpType}, amount ${skrPrice} SKR`;
  tx.add(
    new TransactionInstruction({
      keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoText, 'utf-8'),
    }),
  );

  // 检查收款方 ATA 是否存在，不存在则创建
  // 此处可能会有一笔开销，如果该新钱包还未有 SKR 的 ATA 账户
  try {
    await getAccount(connection, receiverAta, 'confirmed');
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        publicKey,
        receiverAta,
        SKR_RECEIVER,
        SKR_MINT,
      ),
    );
  }

  // 真实结算的 SPL Token 转账指令
  tx.add(
    createTransferInstruction(
      senderAta,
      receiverAta,
      publicKey,
      amount,
    ),
  );

  tx.recentBlockhash = blockhash;
  tx.feePayer = publicKey;

  const signedTx = await signTransaction(tx);
  const rawTx = signedTx.serialize();
  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  );

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return signature;
}
