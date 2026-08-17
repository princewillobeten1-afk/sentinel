import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Rocket, ShieldAlert, CheckCircle, ArrowRight, Wallet, Users, Info } from 'lucide-react';
import { endpoints, apiUrl } from '@/lib/api/endpoints';

export function LaunchWizard() {
  const [step, setStep] = useState(1);
  const [supply, setSupply] = useState(1000000000);
  const [creatorPct, setCreatorPct] = useState(5);
  const [liquidityPct, setLiquidityPct] = useState(80);
  const [communityPct, setCommunityPct] = useState(10);
  const [treasuryPct, setTreasuryPct] = useState(5);
  const [validationResult, setValidationResult] = useState<any>(null);

  const totalPct = creatorPct + liquidityPct + communityPct + treasuryPct;

  const [validationError, setValidationError] = useState<string | null>(null);

  /**
   * Runs preflight analysis through `POST /api/v1/launches` with
   * `action: 'ANALYZE'`, which returns a risk assessment without deploying.
   *
   * Previously posted to `/api/launches/mock-id/actions` — a route that does not
   * exist, so this always 404'd, `data.validation` was undefined, and the wizard
   * silently refused to advance past step 3 with no explanation.
   */
  const handleValidate = async () => {
    setValidationError(null);
    const res = await fetch(apiUrl(endpoints.launches.list), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'ANALYZE',
        config: {
          totalSupply: supply,
          allocations: [
            { category: 'Creator', percentage: creatorPct, amount: (creatorPct/100)*supply },
            { category: 'Liquidity', percentage: liquidityPct, amount: (liquidityPct/100)*supply },
            { category: 'Community', percentage: communityPct, amount: (communityPct/100)*supply },
            { category: 'Treasury', percentage: treasuryPct, amount: (treasuryPct/100)*supply },
          ],
          mintAuthorityEnabled: false,
          freezeAuthorityEnabled: false,
          creatorReputation: 78 // Mocked reputation
        }
      })
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // 403 here means the account lacks the CREATE_LAUNCH scope, which is
      // never auto-granted — worth stating rather than failing silently.
      setValidationError(
        res.status === 403
          ? 'Your account is not approved to create launches.'
          : data?.error?.message || data?.error || 'Validation failed.',
      );
      return;
    }

    setValidationResult(data?.data?.risk ?? data?.risk);
    setStep(4);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {s}
            </div>
            {s < 4 && <div className={`w-16 h-1 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Token Details</CardTitle>
            <CardDescription>Enter the basic metadata for your token.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input placeholder="e.g. Sentinel" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Symbol</label>
              <Input placeholder="e.g. SNT" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input placeholder="Describe your token's utility..." />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => setStep(2)}>Next <ArrowRight className="w-4 h-4 ml-2"/></Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Supply & Allocation</CardTitle>
            <CardDescription>Define how your total supply is distributed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Total Supply</label>
              <Input type="number" value={supply} onChange={(e) => setSupply(Number(e.target.value))} />
            </div>
            
            <div className="space-y-4 pt-4">
              <div className="flex justify-between text-sm">
                <span>Creator Allocation ({creatorPct}%)</span>
                <span className="font-mono">{((creatorPct/100) * supply).toLocaleString()}</span>
              </div>
              <Slider value={[creatorPct]} onValueChange={(v) => setCreatorPct(v[0])} max={100} step={0.1} />

              <div className="flex justify-between text-sm">
                <span>Liquidity Pool ({liquidityPct}%)</span>
                <span className="font-mono">{((liquidityPct/100) * supply).toLocaleString()}</span>
              </div>
              <Slider value={[liquidityPct]} onValueChange={(v) => setLiquidityPct(v[0])} max={100} step={0.1} />

              <div className="flex justify-between text-sm">
                <span>Community ({communityPct}%)</span>
                <span className="font-mono">{((communityPct/100) * supply).toLocaleString()}</span>
              </div>
              <Slider value={[communityPct]} onValueChange={(v) => setCommunityPct(v[0])} max={100} step={0.1} />

              <div className="flex justify-between text-sm">
                <span>Treasury ({treasuryPct}%)</span>
                <span className="font-mono">{((treasuryPct/100) * supply).toLocaleString()}</span>
              </div>
              <Slider value={[treasuryPct]} onValueChange={(v) => setTreasuryPct(v[0])} max={100} step={0.1} />
            </div>

            <div className={`p-3 rounded border ${totalPct === 100 ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}`}>
              Total Allocated: <strong>{totalPct}%</strong>
            </div>

          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={totalPct !== 100}>Next <ArrowRight className="w-4 h-4 ml-2"/></Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Launch Configuration</CardTitle>
            <CardDescription>Set anti-bot and liquidity lock parameters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="p-4 border rounded space-y-2">
                <div className="flex items-center gap-2 font-medium"><ShieldAlert className="w-5 h-5 text-primary"/> Anti-Bot Protection</div>
                <p className="text-sm text-muted-foreground">Automatically limits max wallet size and transaction size during the first 15 minutes of launch.</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary">Max Wallet: 1%</Badge>
                  <Badge variant="secondary">Cooldown: 30s</Badge>
                </div>
             </div>
             
             <div className="p-4 border rounded space-y-2">
                <div className="flex items-center gap-2 font-medium"><Wallet className="w-5 h-5 text-primary"/> Liquidity Lock</div>
                <p className="text-sm text-muted-foreground">Tokens in the LP are locked to prevent rug pulls.</p>
                <Badge variant="secondary">Duration: 180 Days</Badge>
             </div>
            {validationError && (
              <div className="p-3 rounded border bg-red-500/10 border-red-500/50 text-sm text-red-400 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={handleValidate}>Validate Launch</Button>
          </CardFooter>
        </Card>
      )}

      {step === 4 && validationResult && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle className="w-6 h-6 text-green-500"/> Review & Deploy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-sm text-muted-foreground">Creator Reputation</div>
                <div className="text-2xl font-bold text-green-500">78 <span className="text-xs font-normal">/ 100</span></div>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-sm text-muted-foreground">Launch Fairness</div>
                <div className="text-2xl font-bold text-green-500">{validationResult.preliminaryFairnessScore} <span className="text-xs font-normal">/ 100</span></div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2"><Info className="w-4 h-4"/> Validation Results</h4>
              {validationResult.errors.length === 0 ? (
                <div className="text-sm text-green-500">✓ No critical errors found. Supply math is correct.</div>
              ) : (
                validationResult.errors.map((e: string, i: number) => <div key={i} className="text-sm text-red-500">✗ {e}</div>)
              )}
              {validationResult.warnings.map((w: string, i: number) => <div key={i} className="text-sm text-amber-500">⚠ {w}</div>)}
            </div>

          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
            <Button size="lg" className="gap-2"><Rocket className="w-5 h-5"/> Deploy Token</Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
