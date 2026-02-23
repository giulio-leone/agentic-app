/**
 * TerminalPanel — Embedded xterm.js terminal via WebView.
 * Connects to remote shells through the Unified Bridge ACP protocol.
 * Supports spawning new PTY shells and connecting to existing tmux sessions.
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Modal, TouchableOpacity, StyleSheet, Platform, ScrollView, KeyboardAvoidingView } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { X, Maximize2, Minimize2, Terminal, Plus, List } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, FontSize, Radius } from '../utils/theme';
import { useAppStore } from '../stores/appStore';
import { _service } from '../stores/storePrivate';
import { terminalEvents } from '../acp/terminalEvents';
import { ACPConnectionState } from '../acp/models/types';
import { XTERM_HTML, GHOSTTY_HTML } from './terminalHtml';

interface TerminalSession {
  id: string;
  name: string;
  source: 'pty' | 'tmux';
}

interface TmuxSession {
  name: string;
  windows: number;
  attached: boolean;
}



export const TerminalPanel = React.memo(function TerminalPanel() {
  const visible = useAppStore(s => s.terminalVisible);
  const setTerminalVisible = useAppStore(s => s.setTerminalVisible);
  const connectionState = useAppStore(s => s.connectionState);
  const terminalEngine = useAppStore(s => s.terminalEngine);
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [activeTermId, setActiveTermId] = useState<string | null>(null);
  const [tmuxSessions, setTmuxSessions] = useState<TmuxSession[]>([]);
  const [activeSessions, setActiveSessions] = useState<TerminalSession[]>([]);
  const [termSize, setTermSize] = useState({ cols: 80, rows: 24 });

  const isConnected = connectionState === ACPConnectionState.Connected;
  const onClose = useCallback(() => {
    setTerminalVisible(false);
    setShowPicker(false);
  }, [setTerminalVisible]);

  // Clean up terminal event listeners when terminal changes
  useEffect(() => {
    if (!activeTermId) return;
    const unsubData = terminalEvents.onData(activeTermId, (_id, data) => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'write', data }));
    });
    const unsubExit = terminalEvents.onExit(activeTermId, (_id, code) => {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'info', text: `\r\n[Process exited with code ${code}]`
      }));
      setActiveTermId(null);
    });
    return () => { unsubData(); unsubExit(); terminalEvents.cleanup(activeTermId); };
  }, [activeTermId]);

  const refreshSessions = useCallback(async () => {
    if (!isConnected) return;
    try {
      const svc = _service;
      if (!svc) return;
      const resp = await svc.terminalList();
      const result = resp.result as Record<string, unknown>;
      setActiveSessions((result.active as TerminalSession[]) || []);
      setTmuxSessions((result.tmuxSessions as TmuxSession[]) || []);
    } catch { /* bridge may not support terminal yet */ }
  }, [isConnected]);

  const handleSpawn = useCallback(async () => {
    if (!isConnected) return;
    const svc = _service;
    if (!svc) return;
    try {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'clear' }));
      webViewRef.current?.postMessage(JSON.stringify({ type: 'info', text: '⏳ Spawning shell...' }));
      const resp = await svc.terminalSpawn({ cols: termSize.cols, rows: termSize.rows });
      const info = resp.result as unknown as TerminalSession;
      setActiveTermId(info.id);
      setShowPicker(false);
      webViewRef.current?.postMessage(JSON.stringify({ type: 'clear' }));
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'info', text: `✓ Connected to ${info.name} (${info.id})\r\n`
      }));
    } catch (e) {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'error', text: `✗ Failed to spawn: ${e}`
      }));
    }
  }, [isConnected, termSize]);

  const handleConnectTmux = useCallback(async (sessionName: string) => {
    if (!isConnected) return;
    const svc = _service;
    if (!svc) return;
    try {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'clear' }));
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'info', text: `⏳ Connecting to tmux:${sessionName}...`
      }));
      const resp = await svc.terminalConnectTmux(sessionName, termSize.cols, termSize.rows);
      const info = resp.result as unknown as TerminalSession;
      setActiveTermId(info.id);
      setShowPicker(false);
      webViewRef.current?.postMessage(JSON.stringify({ type: 'clear' }));
    } catch (e) {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'error', text: `✗ Failed: ${e}`
      }));
    }
  }, [isConnected, termSize]);

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'input' && activeTermId) {
        _service?.terminalInput(activeTermId, msg.data);
      }
      if (msg.type === 'resize') {
        setTermSize({ cols: msg.cols, rows: msg.rows });
        if (activeTermId) {
          _service?.terminalResize(activeTermId, msg.cols, msg.rows);
        }
      }
      if (msg.type === 'ready') {
        setTermSize({ cols: msg.cols, rows: msg.rows });
      }
    } catch { /* ignore */ }
  }, [activeTermId]);

  return (
    <Modal visible={visible} animationType="slide" transparent={!isFullscreen} onRequestClose={onClose}>
      <YStack
        flex={1}
        backgroundColor={isFullscreen ? '#1a1a2e' : 'rgba(0,0,0,0.5)'}
        justifyContent={isFullscreen ? 'flex-start' : 'flex-end'}
      >
        <YStack
          flex={isFullscreen ? 1 : undefined}
          height={isFullscreen ? undefined : '70%'}
          backgroundColor="#1a1a2e"
          borderTopLeftRadius={isFullscreen ? 0 : Radius.xl}
          borderTopRightRadius={isFullscreen ? 0 : Radius.xl}
          overflow="hidden"
          paddingTop={isFullscreen ? insets.top : 0}
        >
          {/* Header */}
          <XStack
            paddingHorizontal={Spacing.md}
            paddingVertical={Spacing.sm}
            alignItems="center"
            justifyContent="space-between"
            backgroundColor="#16162a"
          >
            <XStack alignItems="center" gap={Spacing.sm}>
              <Terminal size={16} color="#10A37F" />
              <Text fontSize={FontSize.subheadline} fontWeight="600" color="#e4e4e7">
                {activeTermId ? `Terminal (${activeTermId})` : 'Terminal'}
              </Text>
            </XStack>
            <XStack gap={Spacing.sm}>
              <TouchableOpacity onPress={() => { setShowPicker(p => !p); refreshSessions(); }} hitSlop={8} accessibilityLabel="Session list" accessibilityRole="button">
                <List size={16} color="#8E8EA0" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSpawn} hitSlop={8} accessibilityLabel="New shell" accessibilityRole="button">
                <Plus size={16} color="#10A37F" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsFullscreen(f => !f)} hitSlop={8} accessibilityLabel={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} accessibilityRole="button">
                {isFullscreen ? <Minimize2 size={16} color="#8E8EA0" /> : <Maximize2 size={16} color="#8E8EA0" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel="Close terminal" accessibilityRole="button">
                <X size={16} color="#8E8EA0" />
              </TouchableOpacity>
            </XStack>
          </XStack>

          {/* Session picker */}
          {showPicker && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <YStack
                backgroundColor="#16162a"
                paddingHorizontal={Spacing.sm}
                paddingVertical={Spacing.sm}
                borderBottomWidth={StyleSheet.hairlineWidth}
                borderBottomColor="#2a2a4a"
                maxHeight={200}
              >
                {!isConnected && (
                  <Text fontSize={FontSize.caption} color="#f59e0b" marginBottom={Spacing.xs}>
                    ⚠ Not connected to bridge. Connect first.
                  </Text>
                )}
                <TouchableOpacity style={styles.sessionBtn} onPress={handleSpawn} disabled={!isConnected}>
                  <Text fontSize={FontSize.caption} color={isConnected ? '#10A37F' : '#555'}>
                    + New Shell
                  </Text>
                </TouchableOpacity>

                {tmuxSessions.length > 0 && (
                  <>
                    <Text fontSize={10} color="#666" marginTop={Spacing.xs}>TMUX SESSIONS</Text>
                    <ScrollView style={{ maxHeight: 100 }}>
                      {tmuxSessions.map((s) => (
                        <TouchableOpacity
                          key={s.name}
                          style={styles.sessionBtn}
                          onPress={() => handleConnectTmux(s.name)}
                        >
                          <Text fontSize={FontSize.caption} color="#e4e4e7">
                            📺 {s.name} ({s.windows} windows){s.attached ? ' • attached' : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {activeSessions.length > 0 && (
                  <>
                    <Text fontSize={10} color="#666" marginTop={Spacing.xs}>ACTIVE TERMINALS</Text>
                    {activeSessions.map((s) => (
                      <Text key={s.id} fontSize={FontSize.caption} color="#8E8EA0" paddingVertical={2}>
                        {s.source === 'tmux' ? '📺' : '🖥️'} {s.id} — {s.name}
                      </Text>
                    ))}
                  </>
                )}
              </YStack>
            </KeyboardAvoidingView>
          )}

          {/* xterm.js WebView */}
          <WebView
            ref={webViewRef}
            source={{ html: terminalEngine === 'ghostty' ? GHOSTTY_HTML : XTERM_HTML }}
            style={{ flex: 1, backgroundColor: '#1a1a2e' }}
            javaScriptEnabled
            onMessage={handleWebViewMessage}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            allowsInlineMediaPlayback
            originWhitelist={['*']}
          />
        </YStack>
      </YStack>
    </Modal>
  );
});

const styles = StyleSheet.create({
  sessionBtn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    marginVertical: 2,
    backgroundColor: '#1a1a2e',
  },
});
