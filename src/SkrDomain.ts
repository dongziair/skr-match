/**
 * SkrDomain.ts
 * 解析钱包的显示名称：优先 .skr 域名，fallback 为缩短地址
 */

import { Connection, PublicKey } from '@solana/web3.js';

function normalizeSkrDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.endsWith('.skr')) return trimmed;
  if (!trimmed.includes('.')) return `${trimmed}.skr`;
  return null;
}

function pickDomain(candidate: unknown): string | null {
  if (!candidate || typeof candidate !== 'object') return normalizeSkrDomain(candidate);

  const maybeDomain = candidate as {
    domain?: unknown;
    domain_name?: unknown;
    tld?: unknown;
  };

  const directDomain = normalizeSkrDomain(maybeDomain.domain);
  if (directDomain) return directDomain;

  const nameOnly = typeof maybeDomain.domain_name === 'string' ? maybeDomain.domain_name.trim() : '';
  const tld = typeof maybeDomain.tld === 'string' ? maybeDomain.tld.trim() : '';
  if (nameOnly && (tld === '.skr' || tld === 'skr')) {
    return `${nameOnly}.skr`;
  }

  return null;
}

export async function getDisplayName(
  connection: Connection,
  publicKey: PublicKey,
): Promise<string> {
  const addr = publicKey.toBase58();
  const short = `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  try {
    const { TldParser } = await import('@onsol/tldparser');
    const parser = new TldParser(connection);

    try {
      const mainDomain = await parser.getMainDomain(publicKey);
      const resolvedMain = pickDomain(mainDomain);
      if (resolvedMain) return resolvedMain;
    } catch {
      // 主域名未设置时继续尝试其他解析方式
    }

    try {
      const parsedDomains = await parser.getParsedAllUserDomainsFromTld(publicKey, 'skr');
      if (parsedDomains && parsedDomains.length > 0) {
        const resolvedParsed = pickDomain(parsedDomains[0]);
        if (resolvedParsed) return resolvedParsed;
      }
    } catch {
      // 当前方式失败，继续尝试下一种
    }

    try {
      const domains = await parser.getAllUserDomainsFromTld(publicKey, 'skr');
      if (domains && domains.length > 0) {
        const resolved = pickDomain(domains[0]);
        if (resolved) return resolved;
      }
    } catch {
      // 当前方式失败，继续尝试下一种
    }

    for (const tld of ['.skr']) {
      try {
        const parsedDomains = await parser.getParsedAllUserDomainsFromTld(publicKey, tld);
        if (parsedDomains && parsedDomains.length > 0) {
          const resolvedParsed = pickDomain(parsedDomains[0]);
          if (resolvedParsed) return resolvedParsed;
        }
      } catch {
        // 当前方式失败，继续尝试下一种
      }

      try {
        const domains = await parser.getAllUserDomainsFromTld(publicKey, tld);
        if (domains && domains.length > 0) {
          const resolved = pickDomain(domains[0]);
          if (resolved) return resolved;
        }
      } catch {
        // 当前方式失败，继续尝试下一种
      }
    }
  } catch {
    // TldParser 不可用时静默降级
  }

  return short;
}
