import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, ScreenWrapper } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { aiApi, noteApi } from '@/services/api/client';
import { AIChatMessage } from '@/types/ai';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function AIChatScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your StudyMate AI Tutor. Ask me any course question, paste a tricky topic, or let me quiz you on your syllabus.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSocratic, setIsSocratic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || isLoading) return;

    setInputText('');
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Call conversational AI tutor endpoint
      const response = await aiApi.sendMessage({
        message: textToSend,
        session_id: activeSessionId,
        is_socratic: isSocratic,
      });

      if (response.session_id) {
        setActiveSessionId(response.session_id);
      }

      const aiMsg: DisplayMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      // Intelligent fallback tutor reply if network/backend is briefly unavailable
      const fallbackMsg: DisplayMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: `I received your question: "${textToSend}".\n\n1. **Core Concept**: Let's review the fundamental principles.\n2. **Study Tip**: Active recall and spaced repetition are the most effective ways to master this.\n\n*(Note: Make sure your backend server is running on port 8000!)*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore' as never);
    }
  };

  const handleSaveAsNote = async (content: string) => {
    try {
      await noteApi.create({
        title: `AI Note: ${content.slice(0, 30)}...`,
        content: content,
      });
      Alert.alert('Saved!', 'Note has been saved to your Study Notes library.');
    } catch {
      Alert.alert('Error', 'Could not save note right now.');
    }
  };

  return (
    <ScreenWrapper includeTopInset includeBottomInset>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Top Header */}
        <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
          <TouchableOpacity
            onPress={handleBack}
            accessibilityLabel="Go back"
            style={styles.backButton}>
            <Text style={[styles.backIcon, { color: theme.text }]}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <ThemedText type="headlineMedium">AI Study Tutor</ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              Personalized 24/7 Academic Mentor
            </ThemedText>
          </View>
          <Badge label="Active" variant="success" size="sm" />
        </View>

        {/* Socratic Mode Banner */}
        <View
          style={[
            styles.socraticBanner,
            { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
          ]}>
          <View style={styles.socraticTextCol}>
            <ThemedText type="smallBold">Socratic Tutoring Mode</ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              {isSocratic
                ? 'AI asks guiding questions to help you learn'
                : 'AI gives direct academic answers and summaries'}
            </ThemedText>
          </View>
          <Switch
            value={isSocratic}
            onValueChange={setIsSocratic}
            trackColor={{ false: theme.borderSubtle, true: theme.brandPrimary }}
          />
        </View>

        {/* Messages List */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View
                style={[
                  styles.messageRow,
                  isUser ? styles.messageRowUser : styles.messageRowAssistant,
                ]}>
                <View
                  style={[
                    styles.messageBubble,
                    isUser
                      ? { backgroundColor: theme.brandPrimary }
                      : { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle, borderWidth: 1 },
                  ]}>
                  <ThemedText
                    type="bodyMedium"
                    style={{ color: isUser ? '#FFFFFF' : theme.text }}>
                    {item.content}
                  </ThemedText>

                  <View style={styles.messageFooter}>
                    <Text
                      style={[
                        styles.timestamp,
                        { color: isUser ? 'rgba(255,255,255,0.7)' : theme.textTertiary },
                      ]}>
                      {item.timestamp}
                    </Text>
                    {!isUser && (
                      <TouchableOpacity
                        onPress={() => handleSaveAsNote(item.content)}
                        accessibilityLabel="Save as Note">
                        <Text style={[styles.saveActionText, { color: theme.brandPrimary }]}>
                          📝 Save Note
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.brandPrimary} size="small" />
                <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                  AI Tutor is thinking...
                </ThemedText>
              </View>
            ) : undefined
          }
        />

        {/* Quick Suggestion Chips */}
        <View style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle }]}
            onPress={() => handleSend('Explain Big-O Notation like I am 5')}>
            <Text style={[styles.chipText, { color: theme.text }]}>💡 Big-O (ELI5)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle }]}
            onPress={() => handleSend('What is the difference between TCP and UDP?')}>
            <Text style={[styles.chipText, { color: theme.text }]}>🌐 TCP vs UDP</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Input Box */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: theme.cardBackground, borderTopColor: theme.borderSubtle },
          ]}>
          <View
            style={[
              styles.inputBox,
              { backgroundColor: theme.inputBackground, borderColor: theme.borderSubtle },
            ]}>
            <ThemedText
              type="bodyMedium"
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12 }}>
              <TextInputStub
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask any question or concept..."
                placeholderTextColor={theme.textTertiary}
                onSubmitEditing={() => handleSend()}
              />
            </ThemedText>
            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={isLoading || !inputText.trim()}
              style={[
                styles.sendButton,
                { backgroundColor: inputText.trim() ? theme.brandPrimary : theme.borderSubtle },
              ]}>
              <Text style={styles.sendIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

// Lightweight TextInput wrapper
function TextInputStub(props: any) {
  const { TextInput } = require('react-native');
  return <TextInput style={{ flex: 1 }} {...props} />;
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerTitleContainer: {
    flex: 1,
  },
  socraticBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  socraticTextCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  messagesList: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 10,
  },
  saveActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
  inputContainer: {
    padding: Spacing.sm,
    borderTopWidth: 1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingRight: 6,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
  },
});

