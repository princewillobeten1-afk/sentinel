import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { Zap, Copy, ExternalLink, Star, Users, Trophy, Award, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceChange } from '@/components/ui/price-change';
import { TokenBadge, TokenBadgeType } from '@/components/ui/token-badge';
import { Sparkline } from '@/components/ui/sparkline';
import { TokenSocials } from '@/components/ui/token-socials';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { AuditPills } from '@/components/ui/audit-pills';
import { SecurityPills } from '@/components/ui/security-pills';
import { LegendTooltip } from '@/components/ui/legend-tooltip';
import { MetricValue } from '@/components/ui/metric-value';
import { toValueState } from '@/lib/ui/value-state';
import { formatCount } from '@/lib/discovery/format';
import type { MetricEvidence, RugRiskEvidence } from '@/lib/discovery/types';
import { useWatchlist, useAppActions } from '@/lib/store';

export interface TokenCardData {
  name: string;
  symbol: string;
  mint: string;
  price: string;
  priceChange24h: number;
  mcap: string;
  liquidity: string;
  volume24h: string;
  /** `null` when the token has never been scored — renders as a dash. */
  intelligenceScore: number | null;
  logoURI?: string;
  badges?: TokenBadgeType[];
  sparklineData?: number[];
  /**
   * Timestamp of the last live WebSocket update for this token.
   */
  liveUpdatedAt?: number;
  /** Side of the most recent trade, when a trade stream is subscribed. */
  lastTradeSide?: 'BUY' | 'SELL';
  /**
   * Ownership audit. Absent means not measured — never render a zero for it.
   */
  top10HoldingsPct?: number;
  devHoldingsPct?: number;
  devWalletAge?: string;
  sniperPercentage?: number;
  insiderHoldingsPct?: number;
  bundlerPercentage?: number;
  holdersCount?: number;
  proTradersCount?: number;
  kolsCount?: number;
  /** Deployer's graduated/launched record, rendered as one fraction. */
  devMints?: number;
  devMigrations?: number;
  protocol?: string;
  twitterHandle?: string;
  /** True while the audit lookup is queued but unanswered. */
  auditPending?: boolean;
  ownershipEvidence?: MetricEvidence;
  securityEvidence?: MetricEvidence;
  isMintRenounced?: boolean;
  isFreezeDisabled?: boolean;
  isLiquidityLocked?: boolean;
  rugRisk?: RugRiskEvidence;
}

export interface TokenCardProps {
  token: TokenCardData;
  onQuickBuy?: () => void;
  onClick?: () => void;
  className?: string;
}

export function TokenCard({ token, onQuickBuy, onClick, className }: TokenCardProps) {
  const {
    name,
    symbol,
    mint,
    price,
    priceChange24h,
    mcap,
    liquidity,
    volume24h,
    intelligenceScore,
    logoURI,
    badges = [],
    sparklineData,
    liveUpdatedAt,
    lastTradeSide,
  } = token;

  const { isWatchlisted: checkWatchlisted, toggleWatchlist } = useWatchlist();
  const { addNotification } = useAppActions();
  const isWatchlisted = checkWatchlisted(mint);

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    const willWatchlist = !isWatchlisted;
    toggleWatchlist(mint, {
      mint,
      symbol,
      name,
      priceUsd: price.replace('$', ''),
      priceChange24h,
      marketCapUsd: mcap,
      liquidityUsd: liquidity,
      riskRating: token.rugRisk?.completeness === 'complete'
        ? token.rugRisk.level === 'medium' ? 'med' : token.rugRisk.level
        : 'unknown',
      chain: 'solana',
    });
    addNotification({
      title: willWatchlist ? 'Added to Watchlist' : 'Removed from Watchlist',
      message: `${name} ($${symbol}) was ${willWatchlist ? 'added to' : 'removed from'} your watchlist.`,
      type: 'system',
    });
  };

  const [livePrice, setLivePrice] = React.useState(price);
  const [flash, setFlash] = React.useState<'BUY' | 'SELL' | 'NEUTRAL' | null>(null);

  React.useEffect(() => {
    setLivePrice(price);
  }, [price]);

  React.useEffect(() => {
    if (!liveUpdatedAt) return;
    setFlash(lastTradeSide ?? 'NEUTRAL');
    const timer = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(timer);
  }, [liveUpdatedAt, lastTradeSide]);

  /**
   * The deployer's graduated/launched record, e.g. `33/34`.
   *
   * Both fields must be present and devMints must be positive, otherwise
   * the fraction has no meaning and is hidden rather than guessed.
   */
  const devRecord = useMemo(() => {
    if (token.devMints !== undefined && token.devMints > 0 && token.devMigrations != null && Number.isFinite(token.devMigrations)) {
      return `${token.devMigrations}/${token.devMints}`;
    }
    return null;
  }, [token.devMints, token.devMigrations]);

  const proTraders = token.proTradersCount ?? null;
  const kols = token.kolsCount ?? null;
  const anyIdentityKnown =
    token.holdersCount !== undefined ||
    proTraders !== null ||
    kols !== null ||
    devRecord !== null;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'link' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Trade ${symbol}` : undefined}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && onClick && event.key === 'Enter') {
          event.preventDefault();
          onClick();
        }
      }}
      className={clsx(
        'terminal-token-card rounded-md border border-sentinel-700 bg-sentinel-900 p-3 hover:border-slate-600 hover:bg-sentinel-850 transition-colors duration-150 cursor-pointer space-y-3 relative min-w-0 group flex flex-col h-full',
        flash === 'BUY' && 'border-emerald-500/60 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]',
        flash === 'SELL' && 'border-rose-500/60 shadow-[0_0_0_1px_rgba(244,63,94,0.35)]',
        flash === 'NEUTRAL' && 'border-sky-500/50',
        className
      )}
    >

      {/* Identity row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <TokenAvatar
            src={logoURI}
            symbol={symbol}
            name={name}
            mint={mint}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-bold text-slate-100 text-xs truncate group-hover:text-sky-300 transition-colors">
                {name}
              </h3>
              <button
                onClick={handleToggleWatchlist}
                className={`p-1 rounded-md transition-all shrink-0 border ${
                  isWatchlisted
                    ? 'text-amber-400 bg-amber-500/15 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 border-transparent'
                }`}
                title={isWatchlisted ? 'In Watchlist (Click to remove)' : 'Add to Watchlist'}
                aria-label="Toggle Watchlist"
              >
                <Star className={`w-3.5 h-3.5 ${isWatchlisted ? 'fill-amber-400' : ''}`} />
              </button>
            </div>
            <span className="text-2xs font-mono text-slate-400 block truncate">${symbol.replace(/^\$/, '')}</span>
          </div>
        </div>

        {/* Intelligence Score */}
        <div className="text-right font-numeric shrink-0 leading-none">
          <span className="text-2xs text-slate-500 uppercase font-mono block mb-1">Score</span>
          <span
            className={clsx(
              'text-2xs font-bold px-1.5 py-0.5 rounded-md border inline-block whitespace-nowrap',
              intelligenceScore === null || intelligenceScore === undefined
                ? 'bg-slate-500/10 text-slate-500 border-slate-600/30'
                : intelligenceScore >= 80
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : intelligenceScore >= 50
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30',
            )}
          >
            {intelligenceScore === null || intelligenceScore === undefined
              ? '—'
              : `${intelligenceScore}/100`}
          </span>
        </div>
      </div>

      {/* Address + socials, on their own line with room to sit inline. */}
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-2xs text-slate-500 font-numeric shrink-0">
          {mint.slice(0, 4)}...{mint.slice(-4)}
        </p>
        <div className="min-w-0 overflow-hidden">
          <TokenSocials symbol={symbol} showHandles={false} size="xs" className="flex-nowrap" />
        </div>
      </div>

      {/* Badges Row */}
      {badges.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {badges.map((b) => (
            <TokenBadge key={b} type={b} size="sm" />
          ))}
        </div>
      )}

      {/* Ownership audit — same component, thresholds and states as Discover.
          This row was a second copy of the logic that had already drifted:
          no Insiders pill, no pending state, and the whole row hidden unless
          one of three specific fields happened to be present. */}
      <AuditPills
        top10HoldingsPct={token.top10HoldingsPct}
        devHoldingsPct={token.devHoldingsPct}
        devWalletAge={token.devWalletAge}
        sniperPercentage={token.sniperPercentage}
        insiderHoldingsPct={token.insiderHoldingsPct}
        bundlerPercentage={token.bundlerPercentage}
        pending={token.auditPending === true}
        evidence={token.ownershipEvidence}
      />

      <SecurityPills
        isMintRenounced={token.isMintRenounced}
        isFreezeDisabled={token.isFreezeDisabled}
        isLiquidityLocked={token.isLiquidityLocked}
        evidence={token.securityEvidence}
      />

      {token.rugRisk && (
        <LegendTooltip
          label="Rug risk evidence"
          definition={`${token.rugRisk.completeness === 'partial' ? 'Partial evidence' : 'Measured evidence'} · ${token.rugRisk.factors.length ? token.rugRisk.factors.join('; ') : 'No elevated factors in the measured inputs'}. Model ${token.rugRisk.version}.`}
        >
          <span className={clsx(
            'self-start rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase',
            token.rugRisk.level === 'high' || token.rugRisk.level === 'critical'
              ? 'border-rose-800 bg-rose-950/60 text-rose-400'
              : token.rugRisk.level === 'medium'
                ? 'border-amber-800 bg-amber-950/50 text-amber-400'
                : token.rugRisk.completeness === 'complete'
                  ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
                  : 'border-slate-700 bg-slate-900 text-slate-400',
          )}>Risk {token.rugRisk.score} · {token.rugRisk.completeness}</span>
        </LegendTooltip>
      )}

      {/* Identity line: holders, pro traders, KOLs, dev record.
          Same fields and visual language as the discovery card so a token
          that appears in both feeds looks the same. Hidden when nothing is
          known, so an unaudited card does not show an empty row. */}
      {anyIdentityKnown && (
        <div className="flex items-center gap-1.5 flex-wrap text-2xs font-mono font-numeric">
          {/* Holders */}
          {token.holdersCount !== undefined && (
            <LegendTooltip
              label="Holders"
              definition="Total unique holder count."
            >
              <span className="flex items-center gap-0.5 text-slate-300 font-medium">
                <Users className="w-2.5 h-2.5 text-slate-500" />
                <span>{formatCount(token.holdersCount)}</span>
              </span>
            </LegendTooltip>
          )}

          {/* Pro Traders */}
          <LegendTooltip
            label="Pro Traders"
            definition="Count of wallets tagged as historically profitable/experienced."
          >
            <span className="flex items-center gap-0.5 text-slate-300 font-medium">
              <Trophy className="w-2.5 h-2.5 text-amber-400" />
              <MetricValue
                state={toValueState(proTraders, { isPending: token.auditPending === true })}
                label="Pro traders holding"
                format={(v) => formatCount(v)}
              />
            </span>
          </LegendTooltip>

          {/* KOLs */}
          <LegendTooltip
            label="KOLs"
            definition="Count of known influencer wallets currently holding."
          >
            <span className="flex items-center gap-0.5 text-slate-300 font-medium">
              <Award className="w-2.5 h-2.5 text-purple-400" />
              <MetricValue
                state={toValueState(kols, { isPending: token.auditPending === true })}
                label="Known influencer wallets holding"
                format={(v) => formatCount(v)}
              />
            </span>
          </LegendTooltip>

          {/* Dev Track Record (e.g. 33/34) */}
          {devRecord && (
            <LegendTooltip
              label="Dev Track Record"
              definition="Ratio of this deployer wallet's past migrations to total creations — a proxy for whether past tokens graduated successfully or were abandoned."
            >
              <span className="flex items-center gap-0.5 text-amber-400 font-medium">
                <ChefHat className="w-2.5 h-2.5 text-amber-400" />
                <span>{devRecord}</span>
              </span>
            </LegendTooltip>
          )}
        </div>
      )}

      {/* Price & Sparkline */}
      <div className="flex items-baseline justify-between pt-0.5 font-numeric">
        <div>
          <span className="text-base font-bold text-white tracking-tight">{livePrice}</span>
          <div className="mt-0.5">
            <PriceChange value={priceChange24h} size="xs" />
          </div>
        </div>

        {sparklineData && (
          <Sparkline
            data={sparklineData}
            color={priceChange24h >= 0 ? 'emerald' : 'rose'}
            width={65}
            height={24}
          />
        )}
      </div>

      {/* Financial metrics.
          Labels are abbreviated and each column is `min-w-0` + truncate: at a
          third of a narrow card, "Liquidity" and "24h Vol" overflowed their
          columns and ran together as the single string "LIQUIDITY24H VOL". */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-sentinel-800/80 text-2xs font-numeric">
        <div className="min-w-0">
          <span className="text-slate-500 text-2xs uppercase font-mono block truncate">MCap</span>
          <span className="font-bold text-slate-200 block truncate" title={mcap}>{mcap}</span>
        </div>
        <div className="min-w-0">
          <span className="text-slate-500 text-2xs uppercase font-mono block truncate">Liq</span>
          <span className="font-bold text-slate-200 block truncate" title={liquidity}>{liquidity}</span>
        </div>
        <div className="min-w-0">
          <span className="text-slate-500 text-2xs uppercase font-mono block truncate">Vol 24h</span>
          <span className="font-bold text-emerald-400 block truncate" title={volume24h}>{volume24h}</span>
        </div>
      </div>

      {/* Action Execution Button */}
      {onQuickBuy && (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onQuickBuy();
          }}
          variant="buy"
          size="xs"
          className="w-full mt-auto text-xs font-bold"
          leftIcon={<Zap className="h-3 w-3 fill-current" />}
        >
          Quick Trade
        </Button>
      )}
    </div>
  );
}
