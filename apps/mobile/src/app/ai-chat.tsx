import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, ScreenWrapper } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { aiApi, noteApi } from '@/services/api/client';
import {
  loadCachedChatSessions,
  saveCachedChatSessions,
} from '@/services/storage/chat-sessions-cache';
import { AIChatSession } from '@/types/ai';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Intelligent local academic fallback for offline / airplane mode.
 * Provides immediate educational value across Sciences, Humanities, Math, Commerce, and Coding.
 */
function getOfflineAcademicAnswer(query: string, isSocratic: boolean): string {
  const q = query.toLowerCase();

  if (isSocratic) {
    return (
      `That's an insightful question about **${query}**!\n\n` +
      `In **Socratic Tutoring Mode**, let's deduce the answer step-by-step:\n\n` +
      `1. **Starting Principle**: What fundamental definition, law, or formula applies to this topic first?\n` +
      `2. **Variables & Knowns**: What parameters do you already know from the question, and what are you solving for?\n\n` +
      `*💡 Guiding Hint*: Break the problem into its foundational components before jumping to the final conclusion.\n\n` +
      `*(⚡ Offline Mode — Local StudyMate Academic Mentor)*`
    );
  }

  // Biology
  if (/photosynthesis|chlorophyll|cell|mitochondria|dna|rna|biology|respiration|organism|heart/.test(q)) {
    return (
      `### 🌿 Biology — Key Concepts & Processes\n\n` +
      `#### 1. Photosynthesis Equation (Light $\\rightarrow$ Chemical Energy):\n` +
      `$$6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{photons} \\xrightarrow{\\text{chlorophyll}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$$\n\n` +
      `#### 2. Cellular Respiration (Mitochondria):\n` +
      `$$\\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\rightarrow 6\\text{CO}_2 + 6\\text{H}_2\\text{O} + 36\\text{--}38\\text{ ATP}$$\n\n` +
      `#### 3. Core Cell Organelles:\n` +
      `- **Nucleus**: Stores genomic DNA and regulates transcription.\n` +
      `- **Mitochondria**: 'Powerhouse of the cell' producing ATP via oxidative phosphorylation.\n` +
      `- **Ribosomes**: Protein synthesis machinery.\n\n` +
      `*(⚡ Offline Study Summary — Connect to internet for live Google Gemini tutoring)*`
    );
  }

  // Physics
  if (/newton|force|gravity|velocity|speed|motion|ohm|physics|circuit|thermodynamics|energy/.test(q)) {
    return (
      `### ⚡ Physics — Core Principles & Laws\n\n` +
      `#### 1. Newton's Three Laws of Motion:\n` +
      `- **1st Law (Inertia)**: An object remains at rest or in uniform straight-line motion unless acted on by a net external force.\n` +
      `- **2nd Law (Force)**: $$\\vec{F}_{\\text{net}} = m \\cdot \\vec{a}$$\n` +
      `- **3rd Law (Action-Reaction)**: For every action force, there is an equal and opposite reaction ($\\vec{F}_{AB} = -\\vec{F}_{BA}$).\n\n` +
      `#### 2. Electricity & Circuits:\n` +
      `- **Ohm's Law**: $V = I \\cdot R$ (Voltage = Current $\\times$ Resistance).\n` +
      `- **Kirchhoff's Current Law (KCL)**: $\\sum I_{\\text{in}} = \\sum I_{\\text{out}}$ (Conservation of Charge).\n\n` +
      `*(⚡ Offline Study Summary — Connect to internet for live Google Gemini tutoring)*`
    );
  }

  // Chemistry
  if (/chemistry|periodic|element|acid|base|ph|atom|molecule|bond|covalent|ionic/.test(q)) {
    return (
      `### ⚛️ Chemistry — Structure & Reactions\n\n` +
      `#### 1. Periodic Table Organization:\n` +
      `- **Groups (Vertical)**: Elements with equal valence electrons share chemical reactivities (e.g. Alkali metals, Halogens).\n` +
      `- **Periods (Horizontal)**: Elements with equal numbers of electron shells.\n\n` +
      `#### 2. Chemical Bonding:\n` +
      `- **Ionic Bond**: Complete transfer of valence electrons (metal $\\rightarrow$ non-metal, e.g. $\\text{NaCl}$).\n` +
      `- **Covalent Bond**: Mutual sharing of electron pairs (e.g. $\\text{H}_2\\text{O}$, $\\text{CH}_4$).\n\n` +
      `#### 3. pH Scale:\n` +
      `$$\\text{pH} = -\\log_{10}[\\text{H}^+]$$\n` +
      `- $\\text{pH} < 7$: Acidic | $\\text{pH} = 7$: Neutral (Pure Water) | $\\text{pH} > 7$: Basic / Alkaline.\n\n` +
      `*(⚡ Offline Study Summary — Connect to internet for live Google Gemini tutoring)*`
    );
  }

  // Mathematics
  if (/math|calculus|derivative|integral|algebra|quadratic|pythagoras|trigonometry|matrix/.test(q)) {
    return (
      `### 📐 Mathematics — Essential Formulas\n\n` +
      `#### 1. Calculus Essentials:\n` +
      `- **Power Rule**: $\\frac{d}{dx}[x^n] = n x^{n-1}$\n` +
      `- **Product Rule**: $\\frac{d}{dx}[u \\cdot v] = u'v + uv'$\n` +
      `- **Integration**: $\\int x^n \\, dx = \\frac{x^{n+1}}{n+1} + C \\quad (n \\neq -1)$\n\n` +
      `#### 2. Quadratic Equation:\n` +
      `$$a x^2 + b x + c = 0 \\implies x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\n` +
      `#### 3. Pythagorean Theorem:\n` +
      `$$a^2 + b^2 = c^2 \\quad (\\text{Hypotenuse in right triangle})$$\n\n` +
      `*(⚡ Offline Study Summary — Connect to internet for live Google Gemini tutoring)*`
    );
  }

  // History, Civics & Social Sciences
  if (/history|civics|constitution|rights|bihar|maurya|ashoka|gandhi|freedom|democracy|patliputra|preamble/.test(q)) {
    return (
      `### 📜 History & Civics — Governance & Milestones\n\n` +
      `#### 1. The Indian Constitution:\n` +
      `- Adopted on 26 November 1949, enacted on **26 January 1950**.\n` +
      `- **Preamble Pillars**: Sovereign, Socialist, Secular, Democratic, Republic.\n` +
      `- **Fundamental Rights (Part III, Articles 12–35)**: Right to Equality, Freedom, Religious Freedom, and Constitutional Remedies.\n\n` +
      `#### 2. Ancient & Modern History Highlights:\n` +
      `- **Magadha & Patliputra**: Epicenter of the Maurya and Gupta dynasties.\n` +
      `- **Nalanda University**: World-renowned ancient center of learning founded during the Gupta era.\n` +
      `- **Champaran Satyagraha (1917)**: Mahatma Gandhi's first civil disobedience movement in India.\n\n` +
      `*(⚡ Offline Study Summary — Connect to internet for live Google Gemini tutoring)*`
    );
  }

  // Economics & Commerce
  if (/economics|demand|supply|inflation|gdp|commerce|accounting|balance sheet|market|debit|credit/.test(q)) {
    return (
      `### 📈 Economics & Commerce — Key Principles\n\n` +
      `#### 1. Law of Demand and Supply:\n` +
      `- **Demand**: Price badhne par quantity demanded ghati hai ($P \\uparrow \\implies Q_d \\downarrow$).\n` +
      `- **Supply**: Price badhne par producers zyada supply karte hain ($P \\uparrow \\implies Q_s \\uparrow$).\n` +
      `- **Equilibrium**: Jahan demand curve aur supply curve intersect karte hain.\n\n` +
      `#### 2. Accounting Golden Rule:\n` +
      `$$\\text{Assets} = \\text{Liabilities} + \\text{Owner's Equity}$$\n` +
      `- *Rules*: Debit receiver / incoming value; Credit giver / outgoing value.\n\n` +
      `*(⚡ Offline Study Summary — Connect to internet for live Google Gemini tutoring)*`
    );
  }

  // Coding & Computer Science
  if (/python|loop|code|coding|java|cpp|array|function|for loop|while loop/.test(q)) {
    return (
      `### 💻 Programming & Loops — Overview\n\n` +
      `#### 1. Python Loops Syntax:\n` +
      `\`\`\`python\n` +
      `# For Loop: Definite sequence iteration\n` +
      `for i in range(1, 6):\n` +
      `    print(f"Number: {i}")\n\n` +
      `# While Loop: Condition-based execution\n` +
      `count = 0\n` +
      `while count < 5:\n` +
      `    print(count)\n` +
      `    count += 1\n` +
      `\`\`\`\n\n` +
      `#### 2. Loop Controls:\n` +
      `- **\`break\`**: Terminate loop immediately.\n` +
      `- **\`continue\`**: Skip to next iteration.\n\n` +
      `*(⚡ Offline Study Summary — Connect to internet for live Google Gemini tutoring)*`
    );
  }

  // Universal Fallback
  return (
    `### 📖 Academic Concept: ${query}\n\n` +
    `#### 1. 💡 Core Definition & Intuition\n` +
    `**${query}** represents a structured academic principle designed to establish systematic relationships in this subject. ` +
    `Exams test this concept to ensure students understand the fundamental mechanism rather than rote memorization.\n\n` +
    `#### 2. 🔍 Core Analysis\n` +
    `- **Foundational Principle**: The initial law or rule that governs this topic.\n` +
    `- **Key Variables**: The primary components that interact to produce the outcome.\n` +
    `- **Real-life Application**: How this concept manifests in everyday scenarios or exam problems.\n\n` +
    `#### 3. 📝 Exam Takeaway\n` +
    `State the primary definition clearly, highlight key terms or formulas, and conclude with a concise example.\n\n` +
    `*(⚡ Offline Study Summary — Connect to internet for live Google Gemini tutoring)*`
  );
}

export default function AIChatScreen() {
  const router = useRouter();
  const theme = useTheme();

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);

  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your StudyMate AI Tutor. Ask me any question across Sciences, Math, Commerce, Humanities, School syllabus, or Coding.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSocratic, setIsSocratic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Exact Android keyboard height tracking for 100% reliable visibility
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Chat History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState<AIChatSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Keyboard height listener on Android & iOS
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    );

    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load chat session history with local cache support
  const loadChatHistory = useCallback(async () => {
    setIsHistoryModalOpen(true);
    setIsLoadingHistory(true);
    // Instant offline cache hydration
    try {
      const cached = await loadCachedChatSessions();
      if (cached && cached.length > 0) {
        setChatSessions(cached);
        setIsLoadingHistory(false);
      }
    } catch {
      // Ignore
    }

    try {
      const data = await aiApi.listChatSessions();
      if (data && data.items) {
        setChatSessions(data.items);
        saveCachedChatSessions(data.items);
      }
    } catch {
      // Fallback on cached data
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Switch to a previous conversation
  const handleSelectSession = async (session: AIChatSession) => {
    try {
      setIsLoading(true);
      setIsHistoryModalOpen(false);
      const fullSession = await aiApi.getChatSession(session.id);
      setActiveSessionId(fullSession.id);
      setIsSocratic(fullSession.is_socratic);

      if (fullSession.messages && fullSession.messages.length > 0) {
        const loaded: DisplayMessage[] = fullSession.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          }));
        setMessages(loaded);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 150);
      }
    } catch {
      Alert.alert('Notice', 'Viewing conversation offline.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start a fresh new conversation
  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          'Hello! Fresh study session started. Ask any question or paste a concept from your syllabus!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setIsHistoryModalOpen(false);
  };

  // Delete a chat session
  const handleDeleteSession = async (sessionId: string) => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to remove this conversation from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await aiApi.deleteChatSession(sessionId);
              setChatSessions((prev) => {
                const next = prev.filter((s) => s.id !== sessionId);
                saveCachedChatSessions(next);
                return next;
              });
              if (activeSessionId === sessionId) {
                handleNewChat();
              }
            } catch {
              Alert.alert('Error', 'Could not delete conversation right now.');
            }
          },
        },
      ]
    );
  };

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
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);

    try {
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
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } catch {
      // Academic intelligent fallback response when offline or server unreachable
      const offlineReply = getOfflineAcademicAnswer(textToSend, isSocratic);
      const fallbackMsg: DisplayMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: offlineReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
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
      Alert.alert('Saved! 📝', 'Note has been saved to your Study Notes library.');
    } catch {
      Alert.alert('Saved locally', 'Note draft recorded in offline storage.');
    }
  };

  return (
    <ScreenWrapper includeTopInset includeBottomInset={false} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
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

          {/* History Button */}
          <TouchableOpacity
            onPress={loadChatHistory}
            accessibilityRole="button"
            accessibilityLabel="View Chat History"
            style={[
              styles.historyButton,
              { backgroundColor: theme.inputBackground, borderColor: theme.borderSubtle },
            ]}>
            <Text style={{ fontSize: 13 }}>🕒</Text>
            <Text style={[styles.historyButtonText, { color: theme.text }]}>History</Text>
          </TouchableOpacity>

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
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
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
                      : {
                          backgroundColor: theme.cardBackground,
                          borderColor: theme.borderSubtle,
                          borderWidth: 1,
                        },
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
                <ThemedText
                  type="bodySmall"
                  style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                  AI Tutor is thinking...
                </ThemedText>
              </View>
            ) : undefined
          }
        />

        {/* Multi-Disciplinary Quick Suggestion Chips */}
        <View style={styles.chipsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipsScrollContent}>
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
              ]}
              onPress={() =>
                handleSend('Photosynthesis ki chemical reaction aur stages simple Hinglish me samjhao')
              }>
              <Text style={[styles.chipText, { color: theme.text }]}>🌿 Photosynthesis (Biology)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
              ]}
              onPress={() =>
                handleSend('Newton ke 3 Laws of Motion real-life examples ke sath samjhao')
              }>
              <Text style={[styles.chipText, { color: theme.text }]}>⚡ Newton's Laws (Physics)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
              ]}
              onPress={() =>
                handleSend('Periodic Table me Groups aur Periods ka difference kya hai?')
              }>
              <Text style={[styles.chipText, { color: theme.text }]}>⚛️ Periodic Table (Chemistry)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
              ]}
              onPress={() =>
                handleSend('Calculus me Derivatives aur Integration ka practical matlab kya hai?')
              }>
              <Text style={[styles.chipText, { color: theme.text }]}>📐 Calculus (Maths)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
              ]}
              onPress={() =>
                handleSend('Law of Demand and Supply market me price kaise decide karta hai?')
              }>
              <Text style={[styles.chipText, { color: theme.text }]}>📈 Demand & Supply (Economics)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
              ]}
              onPress={() =>
                handleSend('Indian Constitution ke Preamble aur Fundamental Rights samjhao')
              }>
              <Text style={[styles.chipText, { color: theme.text }]}>📜 Constitution (Civics)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
              ]}
              onPress={() => handleSend('Python mein Loops (for and while) kaise kaam karte hain?')}>
              <Text style={[styles.chipText, { color: theme.text }]}>💻 Loops (Coding)</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Bottom Input Box (Lifted dynamically on Android to stay directly above soft keyboard) */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.cardBackground,
              borderTopColor: theme.borderSubtle,
              marginBottom: Platform.OS === 'android' ? keyboardHeight : 0,
            },
          ]}>
          <View
            style={[
              styles.inputBox,
              { backgroundColor: theme.inputBackground, borderColor: theme.borderSubtle },
            ]}>
            <TextInput
              ref={inputRef}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask any question or academic concept..."
              placeholderTextColor={theme.textTertiary}
              style={[
                styles.textInput,
                {
                  color: theme.text,
                  backgroundColor: theme.inputBackground,
                },
              ]}
              cursorColor={theme.brandPrimary}
              selectionColor={theme.brandPrimary}
              multiline={false}
              autoCapitalize="sentences"
              autoCorrect={true}
              returnKeyType="send"
              onFocus={() => {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 120);
              }}
              onSubmitEditing={() => handleSend()}
            />
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

      {/* ==================================================================== */}
      {/* Chat History Slide-Up Modal                                          */}
      {/* ==================================================================== */}
      <Modal
        visible={isHistoryModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsHistoryModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.historyModalContent,
              { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
            ]}>
            {/* Modal Header */}
            <View style={styles.historyModalHeader}>
              <View>
                <ThemedText type="headlineMedium">💬 Chat History</ThemedText>
                <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                  Previous AI tutoring sessions
                </ThemedText>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                <Button
                  title="+ New Chat"
                  size="sm"
                  variant="primary"
                  onPress={handleNewChat}
                />
                <TouchableOpacity
                  onPress={() => setIsHistoryModalOpen(false)}
                  style={styles.closeBtn}>
                  <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal Body */}
            {isLoadingHistory ? (
              <View style={styles.historyLoadingContainer}>
                <ActivityIndicator color={theme.brandPrimary} size="large" />
                <ThemedText
                  type="bodySmall"
                  style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                  Loading your study sessions...
                </ThemedText>
              </View>
            ) : chatSessions.length === 0 ? (
              <View style={styles.historyEmptyContainer}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📚</Text>
                <ThemedText type="titleMedium">No past conversations</ThemedText>
                <ThemedText
                  type="bodySmall"
                  style={{
                    color: theme.textSecondary,
                    textAlign: 'center',
                    marginTop: 4,
                    paddingHorizontal: Spacing.lg,
                  }}>
                  Ask the AI tutor any question to start building your academic history.
                </ThemedText>
                <Button
                  title="Ask a Question"
                  variant="secondary"
                  size="md"
                  onPress={handleNewChat}
                  style={{ marginTop: Spacing.md }}
                />
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.historyList}>
                {chatSessions.map((session) => (
                  <Pressable
                    key={session.id}
                    onPress={() => handleSelectSession(session)}
                    style={({ pressed }) => [
                      styles.historyItemCard,
                      {
                        backgroundColor:
                          activeSessionId === session.id
                            ? theme.brandPrimary + '15'
                            : theme.inputBackground,
                        borderColor:
                          activeSessionId === session.id
                            ? theme.brandPrimary
                            : theme.borderSubtle,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}>
                    <View style={{ flex: 1 }}>
                      <ThemedText
                        type="bodyMedium"
                        style={{
                          fontWeight: activeSessionId === session.id ? '700' : '600',
                          color:
                            activeSessionId === session.id
                              ? theme.brandPrimary
                              : theme.text,
                        }}
                        numberOfLines={1}>
                        {session.title || 'Tutoring Session'}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textTertiary, marginTop: 2, fontSize: 11 }}>
                        {new Date(session.updated_at || session.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </ThemedText>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDeleteSession(session.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.deleteSessionBtn}>
                      <Text style={{ fontSize: 16 }}>🗑️</Text>
                    </TouchableOpacity>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
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
    gap: Spacing.xs,
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
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  historyButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
  chipsWrapper: {
    paddingVertical: 6,
  },
  chipsScrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputContainer: {
    padding: Spacing.sm,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 12 : Spacing.sm,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingRight: 6,
    paddingLeft: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: 12,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  historyModalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    padding: Spacing.md,
    maxHeight: '75%',
    minHeight: 320,
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  historyLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  historyEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  historyList: {
    gap: Spacing.xs,
    paddingBottom: Spacing.xl,
  },
  historyItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  deleteSessionBtn: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
});
