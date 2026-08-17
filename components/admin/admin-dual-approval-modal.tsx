'use client';

import React, { useState } from 'react';
import {
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  UserCheck,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DualApprovalProposal, AdminRole } from '@/lib/admin/types';

interface AdminDualApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdminId: string;
  currentRole: AdminRole;
  proposals: DualApprovalProposal[];
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string, reason: string) => void;
}

export function AdminDualApprovalModal({
  isOpen,
  onClose,
  currentAdminId,
  currentRole,
  proposals,
  onApprove,
  onReject,
}: AdminDualApprovalModalProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  const pendingProposals = proposals.filter((p) => p.status === 'PENDING');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enterprise Dual-Control Approval Governance">
      <div className="space-y-4 max-w-2xl">
        <p className="text-xs text-slate-400">
          High-risk protocol mutations (treasury transfers, global trading halts, fee changes) require approval by a second distinct administrator. Proposing administrators cannot self-approve.
        </p>

        {pendingProposals.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">No Pending Proposals</h4>
            <p className="text-xs text-slate-500">All administrative dual-control requests have been actioned or expired.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 no-scrollbar">
            {pendingProposals.map((prop) => {
              const isSelf = prop.requestedBy === currentAdminId;

              return (
                <div
                  key={prop.id}
                  className="p-4 rounded-xl bg-sentinel-900 border border-white/10 space-y-3 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" size="sm" className="font-mono text-2xs">
                        {prop.actionType}
                      </Badge>
                      <span className="text-xs font-bold text-white font-mono">{prop.id}</span>
                    </div>
                    <span className="text-2xs text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3 text-amber-400" />
                      Expires: {new Date(prop.expiresAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-sentinel-950/80 border border-white/5 text-xs text-slate-300 font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Proposed By:</span>
                      <span className="text-sky-300 font-bold">{prop.requestedBy} ({prop.requestedByRole})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reason:</span>
                      <span className="text-slate-200">{prop.reason}</span>
                    </div>
                    <div className="pt-2 border-t border-white/5">
                      <span className="text-slate-500 block mb-1">Payload:</span>
                      <pre className="text-2xs text-amber-200 overflow-x-auto p-1.5 bg-black/40 rounded">
                        {JSON.stringify(prop.payload, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Actions & Self-Approval Guard Notice */}
                  {isSelf ? (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-2xs flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        Self-Approval Guard: You proposed this action ({currentAdminId}). A distinct second administrator must review and sign.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReject(prop.id, rejectReason || 'Declined by reviewer')}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject Proposal
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onApprove(prop.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Authorize & Execute
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
