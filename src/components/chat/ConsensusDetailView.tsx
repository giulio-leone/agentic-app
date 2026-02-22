/**
 * ConsensusDetailView — Real-time display of consensus analyst responses + reviewer verdict.
 * Shows collapsible cards for each analyst and a reviewer card.
 */

import React, { useState, useMemo } from 'react';
import { TouchableOpacity, ActivityIndicator } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Scale, Sparkles, ShieldAlert, Wrench, CheckCircle } from 'lucide-react-native';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ConsensusDetails } from '../../acp/models/types';
import { MarkdownContent } from './MarkdownContent';

const ROLE_ICONS: Record<string, typeof Sparkles> = {
  optimistic: Sparkles,
  critical: ShieldAlert,
  pragmatic: Wrench,
};

const ROLE_COLORS: Record<string, string> = {
  optimistic: '#22C55E',
  critical: '#EF4444',
  pragmatic: '#3B82F6',
};

interface Props {
  details: ConsensusDetails;
  colors: ThemeColors;
  isStreaming: boolean;
}

type ConsensusAgentResult = ConsensusDetails['agentResults'][number];

function AgentCard({ agent, colors }: { agent: ConsensusAgentResult; colors: ThemeColors }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ROLE_ICONS[agent.agentId] ?? Sparkles;
  const accentColor = ROLE_COLORS[agent.agentId] ?? colors.primary;
  const isComplete = agent.status === 'complete';
  const preview = agent.output.length > 150 ? agent.output.substring(0, 150) + '…' : agent.output;

  return (
    <TouchableOpacity
      style={{
        borderWidth: 1,
        borderLeftWidth: 3,
        borderColor: colors.separator,
        borderLeftColor: accentColor,
        borderRadius: Radius.sm,
        padding: Spacing.sm,
        marginBottom: Spacing.xs,
        backgroundColor: colors.codeBackground,
      }}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <XStack alignItems="center" gap={6}>
        <Icon size={14} color={accentColor} />
        <Text fontSize={FontSize.footnote} fontWeight="600" flex={1} color={colors.text}>
          {agent.role}
        </Text>
        {agent.status === 'running' && <ActivityIndicator size="small" color={accentColor} />}
        {isComplete && <CheckCircle size={14} color={accentColor} />}
        {agent.modelId && (
          <Text fontSize={FontSize.caption} color={colors.textTertiary}>
            {agent.modelId.split('/').pop()}
          </Text>
        )}
        <Text fontSize={14} fontWeight="600" paddingLeft={4} color={colors.textTertiary}>
          {expanded ? '▾' : '▸'}
        </Text>
      </XStack>
      {expanded && isComplete ? (
        <YStack marginTop={8}>
          <MarkdownContent content={agent.output} colors={colors} />
        </YStack>
      ) : !expanded && isComplete ? (
        <Text fontSize={FontSize.caption} marginTop={4} fontStyle="italic" color={colors.textTertiary} numberOfLines={2}>
          {preview}
        </Text>
      ) : agent.status === 'pending' ? (
        <Text fontSize={FontSize.caption} marginTop={4} fontStyle="italic" color={colors.textTertiary}>
          Waiting…
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function ReviewerCard({ verdict, modelId, isRunning, colors }: {
  verdict?: string;
  modelId?: string;
  isRunning: boolean;
  colors: ThemeColors;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!verdict && !isRunning) return null;

  const preview = verdict && verdict.length > 150 ? verdict.substring(0, 150) + '…' : verdict;

  return (
    <TouchableOpacity
      style={{
        borderWidth: 1,
        borderLeftWidth: 3,
        borderColor: colors.separator,
        borderLeftColor: '#F59E0B',
        borderRadius: Radius.sm,
        padding: Spacing.sm,
        backgroundColor: colors.codeBackground,
      }}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <XStack alignItems="center" gap={6}>
        <Scale size={14} color="#F59E0B" />
        <Text fontSize={FontSize.footnote} fontWeight="600" flex={1} color={colors.text}>
          Reviewer
        </Text>
        {isRunning && <ActivityIndicator size="small" color="#F59E0B" />}
        {verdict && <CheckCircle size={14} color="#F59E0B" />}
        {modelId && (
          <Text fontSize={FontSize.caption} color={colors.textTertiary}>
            {modelId.split('/').pop()}
          </Text>
        )}
        <Text fontSize={14} fontWeight="600" paddingLeft={4} color={colors.textTertiary}>
          {expanded ? '▾' : '▸'}
        </Text>
      </XStack>
      {expanded && verdict ? (
        <YStack marginTop={8}>
          <MarkdownContent content={verdict} colors={colors} />
        </YStack>
      ) : verdict ? (
        <Text fontSize={FontSize.caption} marginTop={4} fontStyle="italic" color={colors.textTertiary} numberOfLines={2}>
          {preview}
        </Text>
      ) : isRunning ? (
        <Text fontSize={FontSize.caption} marginTop={4} fontStyle="italic" color={colors.textTertiary}>
          Evaluating…
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export const ConsensusDetailView = React.memo(function ConsensusDetailView({ details, colors, isStreaming }: Props) {
  const completedCount = details.agentResults.filter(a => a.status === 'complete').length;
  const total = details.agentResults.length;

  return (
    <YStack gap={Spacing.xs} marginBottom={Spacing.sm}>
      <XStack alignItems="center" gap={6} marginBottom={2}>
        <Scale size={14} color={colors.primary} />
        <Text fontSize={FontSize.footnote} fontWeight="500" color={colors.textSecondary}>
          {details.status === 'complete'
            ? `Consensus (${total} analysts)`
            : details.status === 'consensus_running'
              ? `Reviewer evaluating (${completedCount}/${total} analysts done)`
              : `Analysts: ${completedCount}/${total} complete`}
        </Text>
        {isStreaming && details.status !== 'complete' && (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
      </XStack>

      {details.agentResults.map(agent => (
        <AgentCard key={agent.agentId} agent={agent} colors={colors} />
      ))}

      <ReviewerCard
        verdict={details.reviewerVerdict}
        modelId={details.reviewerModelId}
        isRunning={details.status === 'consensus_running'}
        colors={colors}
      />
    </YStack>
  );
});
