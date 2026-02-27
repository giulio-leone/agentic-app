/**
 * CliSessionsTab — displays and manages Copilot CLI sessions.
 * Shows a filterable list of sessions from ~/.copilot/session-store.db
 * with resume, view history, and delete capabilities.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { YStack, XStack, Text, Separator } from 'tamagui';
import {
  MessageSquare,
  GitBranch,
  FolderOpen,
  Play,
  Trash2,
  Clock,
  ChevronRight,
  Filter,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { CopilotBridgeService } from '../../ai/copilot';
import type { CliSessionMetadata, CliSessionMessage } from '../../ai/copilot';

// ── Types ────────────────────────────────────────────────────────────────────

interface CliSessionsTabProps {
  isConnected: boolean;
  onResumeSession: (cliSessionId: string, bridgeSessionId: string, model: string) => void;
}

type FilterField = 'all' | 'repository' | 'branch';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function truncatePath(path: string, maxLen = 30): string {
  if (!path || path.length <= maxLen) return path || '';
  return '…' + path.slice(-(maxLen - 1));
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CliSessionsTab({ isConnected, onResumeSession }: CliSessionsTabProps) {
  const { colors } = useDesignSystem();
  const bridge = CopilotBridgeService.getInstance();

  // ── State ──────────────────────────────────────────────────────────────────

  const [sessions, setSessions] = useState<CliSessionMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterField, setFilterField] = useState<FilterField>('all');
  const [filterValue, setFilterValue] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<CliSessionMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null);

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // ── Load sessions ──────────────────────────────────────────────────────────

  const loadSessions = useCallback(async (showLoading = true) => {
    if (!isConnected) return;

    if (showLoading) setLoading(true);
    setError(null);
    try {
      const filter: Record<string, string> = {};
      if (filterField !== 'all' && filterValue) {
        filter[filterField] = filterValue;
      }
      const result = await bridge.listCliSessions(
        Object.keys(filter).length > 0 ? filter : undefined,
      );
      console.log(`[CliSessionsTab] loadSessions: received ${result.sessions.length} sessions`);
      setSessions(result.sessions);
      setHasLoadedOnce(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[CliSessionsTab] loadSessions error: ${msg}`);
      if (!hasLoadedOnce) setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isConnected, bridge, filterField, filterValue, hasLoadedOnce]);

  useEffect(() => {
    if (isConnected) loadSessions();
  }, [isConnected, loadSessions]);

  // ── View messages ──────────────────────────────────────────────────────────

  const handleToggleExpand = useCallback(async (sessionId: string) => {
    Haptics.selectionAsync();
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setSessionMessages([]);
      return;
    }

    setExpandedSessionId(sessionId);
    setLoadingMessages(true);
    setSessionMessages([]);

    try {
      const result = await bridge.getCliSessionMessages(sessionId);
      setSessionMessages(result.messages);
    } catch {
      setSessionMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [expandedSessionId, bridge]);

  // ── Resume ─────────────────────────────────────────────────────────────────

  const handleResume = useCallback(async (sessionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResumingSessionId(sessionId);
    try {
      const result = await bridge.resumeCliSession(sessionId);
      onResumeSession(sessionId, result.bridgeSessionId, result.model);
    } catch (err) {
      Alert.alert('Resume Failed', err instanceof Error ? err.message : 'Could not resume session');
    } finally {
      setResumingSessionId(null);
    }
  }, [bridge, onResumeSession]);

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = useCallback((sessionId: string, summary?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Session',
      `Delete "${summary || sessionId.slice(0, 8)}…"?\n\nThis permanently removes the session and all conversation history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await bridge.deleteCliSession(sessionId);
              setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
              if (expandedSessionId === sessionId) {
                setExpandedSessionId(null);
                setSessionMessages([]);
              }
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed');
            }
          },
        },
      ],
    );
  }, [bridge, expandedSessionId]);

  // ── Unique filter values ───────────────────────────────────────────────────

  const uniqueRepos = useMemo(() => {
    const repos = new Set<string>();
    sessions.forEach(s => {
      if (s.context?.repository) repos.add(s.context.repository);
    });
    return Array.from(repos).sort();
  }, [sessions]);

  const uniqueBranches = useMemo(() => {
    const branches = new Set<string>();
    sessions.forEach(s => {
      if (s.context?.branch) branches.add(s.context.branch);
    });
    return Array.from(branches).sort();
  }, [sessions]);

  // ── Render empty state ─────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <YStack padding={Spacing.xl} alignItems="center" gap={Spacing.md}>
        <MessageSquare size={40} color={colors.textTertiary} />
        <Text fontSize={FontSize.body} color="$textTertiary" textAlign="center">
          Connect to a bridge to view CLI sessions
        </Text>
      </YStack>
    );
  }

  if (loading && sessions.length === 0) {
    return (
      <YStack padding={Spacing.xl} alignItems="center" gap={Spacing.md}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text fontSize={FontSize.body} color="$textTertiary">Loading sessions…</Text>
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack padding={Spacing.xl} alignItems="center" gap={Spacing.md}>
        <Text fontSize={FontSize.body} color={colors.destructive} textAlign="center">{error}</Text>
        <TouchableOpacity onPress={() => loadSessions()}>
          <Text fontSize={FontSize.body} color="$primary" fontWeight="600">Retry</Text>
        </TouchableOpacity>
      </YStack>
    );
  }

  // ── Render session card ────────────────────────────────────────────────────

  const renderSession = ({ item }: { item: CliSessionMetadata }) => {
    const isExpanded = expandedSessionId === item.sessionId;
    const isResuming = resumingSessionId === item.sessionId;

    return (
      <YStack
        backgroundColor="$cardBackground"
        borderRadius={Radius.md}
        overflow="hidden"
        marginBottom={Spacing.sm}
      >
        {/* Session header — tap to expand */}
        <TouchableOpacity
          onPress={() => handleToggleExpand(item.sessionId)}
          style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md }}
          activeOpacity={0.7}
        >
          <XStack alignItems="center" gap={Spacing.sm}>
            <YStack flex={1} gap={2}>
              {/* Summary / title */}
              <Text fontSize={FontSize.body} fontWeight="600" color="$color" numberOfLines={2}>
                {item.summary || `Session ${item.sessionId.slice(0, 8)}…`}
              </Text>

              {/* Context line: repo + branch */}
              <XStack gap={Spacing.sm} alignItems="center" flexWrap="wrap">
                {item.context?.repository && (
                  <XStack gap={2} alignItems="center">
                    <GitBranch size={11} color={colors.textTertiary} />
                    <Text fontSize={FontSize.caption} color="$textTertiary">
                      {item.context.repository}
                    </Text>
                  </XStack>
                )}
                {item.context?.branch && (
                  <XStack gap={2} alignItems="center">
                    <GitBranch size={11} color={colors.primary} />
                    <Text fontSize={FontSize.caption} color="$primary">
                      {item.context.branch}
                    </Text>
                  </XStack>
                )}
                {item.context?.cwd && (
                  <XStack gap={2} alignItems="center">
                    <FolderOpen size={11} color={colors.textTertiary} />
                    <Text fontSize={FontSize.caption} color="$textTertiary">
                      {truncatePath(item.context.cwd)}
                    </Text>
                  </XStack>
                )}
              </XStack>

              {/* Time */}
              <XStack gap={4} alignItems="center" marginTop={2}>
                <Clock size={10} color={colors.textTertiary} />
                <Text fontSize={11} color="$textTertiary">
                  {formatRelativeTime(item.modifiedTime)}
                </Text>
              </XStack>
            </YStack>

            <ChevronRight
              size={16}
              color={colors.textTertiary}
              style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
            />
          </XStack>
        </TouchableOpacity>

        {/* Expanded: messages preview + actions */}
        {isExpanded && (
          <>
            <Separator borderColor="$separator" />

            {/* Messages preview */}
            {loadingMessages ? (
              <YStack padding={Spacing.md} alignItems="center">
                <ActivityIndicator size="small" color={colors.primary} />
              </YStack>
            ) : sessionMessages.length > 0 ? (
              <YStack paddingHorizontal={Spacing.lg} paddingVertical={Spacing.sm} gap={Spacing.xs} maxHeight={200}>
                {sessionMessages
                  .filter(m => m.role === 'user' || m.role === 'assistant')
                  .slice(-6)
                  .map((msg) => (
                    <XStack key={msg.id} gap={Spacing.sm} alignItems="flex-start">
                      <Text
                        fontSize={10}
                        fontWeight="700"
                        color={msg.role === 'user' ? '$primary' : colors.textSecondary}
                        width={14}
                      >
                        {msg.role === 'user' ? 'U' : 'A'}
                      </Text>
                      <Text
                        fontSize={FontSize.caption}
                        color="$color"
                        numberOfLines={2}
                        flex={1}
                      >
                        {msg.content.slice(0, 200)}
                      </Text>
                    </XStack>
                  ))}
                {sessionMessages.filter(m => m.role === 'user' || m.role === 'assistant').length > 6 && (
                  <Text fontSize={11} color="$textTertiary" textAlign="center">
                    … {sessionMessages.filter(m => m.role === 'user' || m.role === 'assistant').length - 6} more messages
                  </Text>
                )}
              </YStack>
            ) : (
              <YStack padding={Spacing.md} alignItems="center">
                <Text fontSize={FontSize.caption} color="$textTertiary">No messages</Text>
              </YStack>
            )}

            <Separator borderColor="$separator" />

            {/* Action buttons */}
            <XStack paddingHorizontal={Spacing.lg} paddingVertical={Spacing.sm} gap={Spacing.md} justifyContent="flex-end">
              <TouchableOpacity
                onPress={() => handleDelete(item.sessionId, item.summary)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 }}
              >
                <Trash2 size={14} color={colors.destructive} />
                <Text fontSize={FontSize.caption} color={colors.destructive} fontWeight="500">Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleResume(item.sessionId)}
                disabled={isResuming}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: 6,
                  paddingHorizontal: Spacing.md,
                  backgroundColor: colors.primary,
                  borderRadius: Radius.sm,
                  opacity: isResuming ? 0.6 : 1,
                }}
              >
                {isResuming ? (
                  <ActivityIndicator size="small" color={colors.contrastText} />
                ) : (
                  <>
                    <Play size={14} color={colors.contrastText} />
                    <Text fontSize={FontSize.caption} color="$contrastText" fontWeight="600">Resume</Text>
                  </>
                )}
              </TouchableOpacity>
            </XStack>
          </>
        )}
      </YStack>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <YStack flex={1}>
      {/* Filter bar */}
      <XStack
        paddingHorizontal={Spacing.lg}
        paddingVertical={Spacing.sm}
        gap={Spacing.sm}
        alignItems="center"
      >
        <Filter size={14} color={colors.textTertiary} />
        {(['all', 'repository', 'branch'] as FilterField[]).map(field => (
          <TouchableOpacity
            key={field}
            onPress={() => {
              Haptics.selectionAsync();
              setFilterField(field);
              setFilterValue('');
            }}
            style={{
              paddingHorizontal: Spacing.sm,
              paddingVertical: 4,
              borderRadius: Radius.sm,
              backgroundColor: filterField === field ? colors.primary : colors.systemGray5,
            }}
          >
            <Text
              fontSize={11}
              fontWeight="600"
              color={filterField === field ? '$contrastText' : '$textTertiary'}
            >
              {field === 'all' ? 'All' : field === 'repository' ? 'Repo' : 'Branch'}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Filter value chips */}
        {filterField === 'repository' && uniqueRepos.length > 0 && (
          <XStack gap={4} flexWrap="wrap">
            {uniqueRepos.map(repo => (
              <TouchableOpacity
                key={repo}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilterValue(filterValue === repo ? '' : repo);
                }}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 10,
                  backgroundColor: filterValue === repo ? colors.primary : colors.systemGray5,
                }}
              >
                <Text
                  fontSize={10}
                  color={filterValue === repo ? '$contrastText' : '$textTertiary'}
                >
                  {repo.split('/').pop()}
                </Text>
              </TouchableOpacity>
            ))}
          </XStack>
        )}

        {filterField === 'branch' && uniqueBranches.length > 0 && (
          <XStack gap={4} flexWrap="wrap">
            {uniqueBranches.map(branch => (
              <TouchableOpacity
                key={branch}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilterValue(filterValue === branch ? '' : branch);
                }}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 10,
                  backgroundColor: filterValue === branch ? colors.primary : colors.systemGray5,
                }}
              >
                <Text
                  fontSize={10}
                  color={filterValue === branch ? '$contrastText' : '$textTertiary'}
                >
                  {branch}
                </Text>
              </TouchableOpacity>
            ))}
          </XStack>
        )}
      </XStack>

      {/* Sessions count */}
      <XStack paddingHorizontal={Spacing.lg} paddingBottom={Spacing.xs}>
        <Text fontSize={11} color="$textTertiary">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </Text>
      </XStack>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <YStack padding={Spacing.xl} alignItems="center" gap={Spacing.md}>
          <MessageSquare size={32} color={colors.textTertiary} />
          <Text fontSize={FontSize.body} color="$textTertiary" textAlign="center">
            No CLI sessions found
          </Text>
          <Text fontSize={FontSize.caption} color="$textTertiary" textAlign="center">
            Sessions from `copilot` CLI will appear here
          </Text>
        </YStack>
      ) : (
        <YStack paddingHorizontal={Spacing.lg} paddingBottom={Spacing.xl}>
          {sessions.map(item => (
            <React.Fragment key={item.sessionId}>
              {renderSession({ item })}
            </React.Fragment>
          ))}
        </YStack>
      )}
    </YStack>
  );
}
