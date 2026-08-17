import type {
  ActivityAlertEvent,
  InsiderDetectionReport,
  OrganicActivityAssessment,
} from './types';

export function buildActivityAlertEvents(
  assessment: OrganicActivityAssessment,
  previousAssessment?: OrganicActivityAssessment,
): ActivityAlertEvent[] {
  const events: ActivityAlertEvent[] = [];
  const occurredAt = assessment.generatedAt;

  if (previousAssessment && Math.abs(assessment.score - previousAssessment.score) >= 10) {
    events.push({
      type: 'ORGANIC_ACTIVITY_CHANGED',
      tokenId: assessment.tokenId,
      chain: assessment.chain,
      severity: Math.abs(assessment.score - previousAssessment.score) >= 20 ? 'warning' : 'info',
      title: `Organic activity score changed from ${previousAssessment.score} to ${assessment.score}`,
      evidence: assessment.signals.flatMap((signal) => signal.evidence).slice(0, 5),
      confidence: assessment.confidence / 100,
      metadata: {
        previousScore: previousAssessment.score,
        currentScore: assessment.score,
        window: assessment.window,
      },
      occurredAt,
    });
  }

  if (assessment.features.participation.top5WalletShare >= 0.45) {
    events.push({
      type: 'VOLUME_CONCENTRATION_SPIKE',
      tokenId: assessment.tokenId,
      chain: assessment.chain,
      severity: assessment.features.participation.top5WalletShare >= 0.65 ? 'critical' : 'warning',
      title: 'Volume concentration spike detected',
      evidence: assessment.signals.filter((signal) => signal.type === 'VOLUME_CONCENTRATION').flatMap((signal) => signal.evidence),
      confidence: 0.86,
      metadata: {
        top5WalletShare: assessment.features.participation.top5WalletShare,
        window: assessment.window,
      },
      occurredAt,
    });
  }

  if (assessment.features.circularActivityScore >= 45 || assessment.features.concentration.topClusterVolumeShare >= 0.3) {
    events.push({
      type: 'COORDINATED_ACTIVITY_DETECTED',
      tokenId: assessment.tokenId,
      chain: assessment.chain,
      severity: assessment.features.circularActivityScore >= 75 ? 'critical' : 'warning',
      title: 'Potential coordinated activity detected',
      evidence: assessment.signals
        .filter((signal) => signal.type === 'POTENTIAL_CIRCULAR_ACTIVITY' || signal.type === 'CLUSTER_CONCENTRATION')
        .flatMap((signal) => signal.evidence)
        .slice(0, 5),
      confidence: 0.78,
      metadata: {
        circularActivityScore: assessment.features.circularActivityScore,
        topClusterVolumeShare: assessment.features.concentration.topClusterVolumeShare,
        window: assessment.window,
      },
      occurredAt,
    });
  }

  if (assessment.features.creatorLinkedVolumeShare >= 0.1) {
    events.push({
      type: 'CREATOR_LINKED_ACTIVITY',
      tokenId: assessment.tokenId,
      chain: assessment.chain,
      severity: assessment.features.creatorLinkedVolumeShare >= 0.3 ? 'critical' : 'warning',
      title: 'Creator-linked activity observed',
      evidence: assessment.signals.filter((signal) => signal.type === 'CREATOR_LINKED_ACTIVITY').flatMap((signal) => signal.evidence),
      confidence: 0.82,
      metadata: {
        creatorLinkedVolumeShare: assessment.features.creatorLinkedVolumeShare,
        creatorLinkedVolumeUsd: assessment.features.creatorLinkedVolumeUsd,
        window: assessment.window,
      },
      occurredAt,
    });
  }

  return events;
}

export function buildInsiderAlertEvents(report: InsiderDetectionReport): ActivityAlertEvent[] {
  const events: ActivityAlertEvent[] = [];

  for (const participant of report.earlyParticipants.filter((item) => item.initialSizeUsd >= 10_000 && item.secondsFromLaunch <= 300).slice(0, 10)) {
    events.push({
      type: 'EARLY_LARGE_BUY',
      tokenId: report.tokenId,
      chain: report.chain,
      severity: participant.initialSizeUsd >= 100_000 ? 'critical' : 'warning',
      title: 'Early large buy observed',
      evidence: participant.evidence,
      confidence: participant.earlyParticipationScore / 100,
      metadata: {
        wallet: participant.wallet,
        initialSizeUsd: participant.initialSizeUsd,
        secondsFromLaunch: participant.secondsFromLaunch,
      },
      occurredAt: participant.entryTime,
    });
  }

  for (const candidate of report.candidates.filter((item) => item.score >= 65 && item.confidence >= 60).slice(0, 10)) {
    events.push({
      type: 'POTENTIAL_INSIDER_PATTERN',
      tokenId: report.tokenId,
      chain: report.chain,
      severity: candidate.score >= 80 ? 'critical' : 'warning',
      title: 'Potential early or coordinated activity pattern observed',
      evidence: candidate.evidence.slice(0, 6),
      confidence: candidate.confidence / 100,
      metadata: {
        wallet: candidate.wallet,
        score: candidate.score,
        status: candidate.status,
        labels: candidate.labels,
      },
      occurredAt: candidate.firstObserved,
    });
  }

  for (const group of report.coordinatedExitGroups) {
    const representative = group[0];
    events.push({
      type: 'COORDINATED_EXIT',
      tokenId: report.tokenId,
      chain: report.chain,
      severity: group.length >= 5 ? 'critical' : 'warning',
      title: `${group.length} candidate wallets exited within a narrow window`,
      evidence: group.flatMap((candidate) => candidate.evidence).slice(0, 6),
      confidence: Math.min(0.9, group.reduce((total, candidate) => total + candidate.confidence, 0) / group.length / 100),
      metadata: {
        wallets: group.map((candidate) => candidate.wallet),
      },
      occurredAt: representative.firstObserved,
    });
  }

  return events;
}
