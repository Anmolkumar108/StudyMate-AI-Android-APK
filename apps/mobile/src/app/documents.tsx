import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, Input, ScreenWrapper } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { documentApi } from '@/services/api/client';
import { Document } from '@/types/document';

async function readFileAsBase64(uri: string): Promise<string> {
  // Strategy 1: expo-file-system File instance (native C++/Android direct read)
  try {
    const file = new File(uri);
    const b64 = await file.base64();
    if (b64 && b64.length > 0) return b64;
  } catch {
    // Fall back to strategy 2
  }

  // Strategy 2 fallback: fetch local blob + FileReader
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = (reader.result as string) || '';
        const commaIdx = res.indexOf(',');
        resolve(commaIdx > -1 ? res.slice(commaIdx + 1) : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err: any) {
    throw new Error(`Could not read file from device storage: ${err?.message || 'Permission denied'}`);
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AnimatedDocCardProps {
  item: Document;
  index: number;
  onPress: () => void;
  onQuizPress: () => void;
  onDeletePress: () => void;
}

function AnimatedDocCard({
  item,
  index,
  onPress,
  onQuizPress,
  onDeletePress,
}: AnimatedDocCardProps) {
  const theme = useTheme();

  const [opacityAnim] = useState(() => new Animated.Value(0));
  const [translateYAnim] = useState(() => new Animated.Value(14));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (reduced) {
          opacityAnim.setValue(1);
          translateYAnim.setValue(0);
          return;
        }

        const delay = Math.min(index * 40, 220);
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 220,
            delay,
            useNativeDriver: true,
          }),
          Animated.spring(translateYAnim, {
            toValue: 0,
            friction: 7,
            tension: 50,
            delay,
            useNativeDriver: true,
          }),
        ]).start();
      })
      .catch(() => {
        opacityAnim.setValue(1);
        translateYAnim.setValue(0);
      });
  }, [opacityAnim, translateYAnim, index]);

  const isPdf =
    item.file_name?.toLowerCase().endsWith('.pdf') ||
    item.mime_type === 'application/pdf';
  const accentColor = isPdf ? '#EF4444' : theme.brandPrimary;

  const keyConcepts = Array.isArray(item.summary_key_concepts)
    ? item.summary_key_concepts
    : typeof item.summary_key_concepts === 'object' && item.summary_key_concepts !== null
      ? Object.values(item.summary_key_concepts)
      : [];

  return (
    <Animated.View
      style={{
        opacity: opacityAnim,
        transform: [{ translateY: translateYAnim }],
        marginBottom: Spacing.sm,
      }}>
      <Card
        variant="default"
        onPress={onPress}
        accessibilityLabel={`Document: ${item.title}, ${formatFileSize(item.file_size_bytes)}`}
        accessibilityHint="Opens full AI Cornell summary and document details"
        style={[
          styles.docCard,
          {
            borderColor: accentColor + '30',
            shadowColor: accentColor,
          },
        ]}>
        {/* Left Color Accent Capsule Bar */}
        <View style={styles.cardAccentBarWrapper}>
          <View style={[styles.cardAccentBar, { backgroundColor: accentColor }]} />
          <View style={[styles.cardAccentDot, { backgroundColor: accentColor }]} />
        </View>

        <View style={styles.cardInnerContent}>
          {/* Header Row: File Tag & Status Badge */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardBadgesGroup}>
              <View
                style={[
                  styles.fileTypeBadge,
                  {
                    backgroundColor: accentColor + '18',
                    borderColor: accentColor + '40',
                  },
                ]}>
                <Text style={{ fontSize: 11 }}>{isPdf ? '📕' : '📝'}</Text>
                <ThemedText
                  type="smallBold"
                  style={{
                    color: accentColor,
                    fontSize: 10,
                    letterSpacing: 0.4,
                  }}>
                  {isPdf ? 'PDF' : 'DOC'}
                </ThemedText>
              </View>

              {item.page_count ? (
                <View
                  style={[
                    styles.pageCountBadge,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.borderSubtle,
                    },
                  ]}>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, fontSize: 10 }}>
                    📄 {item.page_count} {item.page_count === 1 ? 'page' : 'pages'}
                  </ThemedText>
                </View>
              ) : null}

              <ThemedText
                type="small"
                style={{ color: theme.textTertiary, fontSize: 11 }}>
                • {formatFileSize(item.file_size_bytes)}
              </ThemedText>
            </View>

            {/* Status Indicator */}
            {item.status === 'ready' ? (
              <Badge label="✓ Ready" variant="success" size="sm" />
            ) : item.status === 'processing' ? (
              <Badge label="⚡ Processing..." variant="warning" size="sm" />
            ) : item.status === 'failed' ? (
              <Badge label="Failed" variant="danger" size="sm" />
            ) : (
              <Badge label="Pending" variant="neutral" size="sm" />
            )}
          </View>

          {/* Document Title */}
          <ThemedText
            type="titleMedium"
            numberOfLines={2}
            style={styles.cardTitle}>
            {item.title}
          </ThemedText>

          {/* File Name */}
          <ThemedText
            type="bodySmall"
            numberOfLines={1}
            style={{ color: theme.textTertiary, fontSize: 11 }}>
            📎 {item.file_name}
          </ThemedText>

          {/* AI Executive Summary Preview (if ready) */}
          {item.summary_tldr ? (
            <View
              style={[
                styles.summaryPreviewBox,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.brandPrimary + '24',
                },
              ]}>
              <View style={styles.summaryPreviewHeader}>
                <Text style={{ fontSize: 12 }}>💡</Text>
                <ThemedText
                  type="smallBold"
                  style={{ color: theme.brandPrimary, fontSize: 11 }}>
                  AI Cornell Summary
                </ThemedText>
              </View>
              <ThemedText
                type="bodySmall"
                numberOfLines={2}
                style={[styles.summaryPreviewText, { color: theme.textSecondary }]}>
                {item.summary_tldr}
              </ThemedText>
            </View>
          ) : null}

          {/* Key Concepts Preview Tags */}
          {keyConcepts.length > 0 ? (
            <View style={styles.conceptsRow}>
              {keyConcepts.slice(0, 3).map((concept: any, idx) => {
                const label =
                  typeof concept === 'string'
                    ? concept
                    : String(concept?.name || concept?.title || concept);
                return (
                  <View
                    key={idx}
                    style={[
                      styles.conceptPill,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.borderSubtle,
                      },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary, fontSize: 10 }}>
                      🏷️ {label}
                    </ThemedText>
                  </View>
                );
              })}
              {keyConcepts.length > 3 ? (
                <ThemedText
                  type="small"
                  style={{ color: theme.textTertiary, fontSize: 10, alignSelf: 'center' }}>
                  +{keyConcepts.length - 3} more
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {/* Card Footer Actions Row */}
          <View
            style={[
              styles.cardFooterRow,
              { borderTopColor: theme.borderSubtle },
            ]}>
            <Pressable
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel="Read full document analysis"
              style={({ pressed }) => [
                styles.readPillBtn,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.borderSubtle,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: theme.textSecondary, fontSize: 11 }}>
                📖 Read & Inspect →
              </ThemedText>
            </Pressable>

            <View style={styles.footerRightActions}>
              <Pressable
                onPress={onQuizPress}
                accessibilityRole="button"
                accessibilityLabel="Practice AI Quiz from this document"
                style={({ pressed }) => [
                  styles.quickQuizBtn,
                  {
                    backgroundColor: theme.brandPrimary,
                    opacity: pressed ? 0.85 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}>
                <Text style={{ fontSize: 12 }}>⚡</Text>
                <ThemedText
                  type="smallBold"
                  style={{ color: '#FFFFFF', fontSize: 11 }}>
                  Practice Quiz
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={onDeletePress}
                accessibilityRole="button"
                accessibilityLabel="Delete document"
                style={({ pressed }) => [
                  styles.cardDeleteBtn,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.statusDanger + '30',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <Text style={{ fontSize: 13, color: theme.statusDanger }}>🗑️</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

export default function DocumentsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'processing'>('all');
  const [sortMode, setSortMode] = useState<'recent' | 'title' | 'pages'>('recent');

  // Direct Text Document Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isCreatingTextDoc, setIsCreatingTextDoc] = useState(false);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await documentApi.listDocuments();
      setDocuments(res.items);
    } catch {
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Auto-poll when any document is still processing in background
  useEffect(() => {
    const hasPending = documents.some(
      (d) => d.status === 'processing' || d.status === 'upload_pending'
    );
    if (hasPending) {
      const timer = setTimeout(() => {
        documentApi
          .listDocuments()
          .then((res) => setDocuments(res.items))
          .catch(() => {});
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [documents]);

  const totalPagesCount = useMemo(() => {
    return documents.reduce((acc, d) => acc + (d.page_count || 1), 0);
  }, [documents]);

  const readyDocsCount = useMemo(() => {
    return documents.filter((d) => d.status === 'ready').length;
  }, [documents]);

  const processingDocsCount = useMemo(() => {
    return documents.filter((d) => d.status === 'processing' || d.status === 'upload_pending').length;
  }, [documents]);

  // Filtered and sorted documents list
  const filteredAndSortedDocs = useMemo(() => {
    const list = documents.filter((doc) => {
      const cleanSearch = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !cleanSearch ||
        doc.title.toLowerCase().includes(cleanSearch) ||
        (doc.file_name && doc.file_name.toLowerCase().includes(cleanSearch)) ||
        (doc.summary_tldr && doc.summary_tldr.toLowerCase().includes(cleanSearch));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'ready' && doc.status === 'ready') ||
        (statusFilter === 'processing' &&
          (doc.status === 'processing' || doc.status === 'upload_pending'));

      return matchesSearch && matchesStatus;
    });

    if (sortMode === 'title') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortMode === 'pages') {
      return [...list].sort((a, b) => (b.page_count || 0) - (a.page_count || 0));
    }
    return list;
  }, [documents, searchQuery, statusFilter, sortMode]);

  const handlePickAndUploadPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.name || 'document.pdf';
      const title = fileName.replace(/\.pdf$/i, '').trim();

      setIsUploading(true);

      try {
        const base64Data = await readFileAsBase64(asset.uri);
        await documentApi.uploadBase64Document({
          title: title || 'Lecture PDF Document',
          filename: fileName,
          file_base64: base64Data,
        });
      } catch {
        // Fallback to FormData multipart upload if base64 read encountered an issue
        const formData = new FormData();
        formData.append('title', title || 'Lecture PDF Document');
        formData.append('file', {
          uri: asset.uri,
          name: fileName,
          type: 'application/pdf',
        } as any);
        await documentApi.uploadDocument(formData);
      }

      Alert.alert(
        'Upload Successful',
        'Your PDF has been uploaded. AI is extracting key concepts and generating an executive Cornell summary in the background.'
      );
      await fetchDocuments();
    } catch (err: any) {
      Alert.alert(
        'Upload Error',
        err?.message || 'Could not upload PDF document. Please check your connection.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadDemoPDF = async () => {
    try {
      setIsUploading(true);
      const samplePdfContent =
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Length 145 >>\nstream\n' +
        'BT /F1 14 Tf 50 700 Td (StudyMate AI Sample Lecture: Object Oriented Programming) Tj\n' +
        '0 -30 Td (Key Topics: Encapsulation, Polymorphism, Abstraction, Inheritance) Tj ET\n' +
        'endstream\nendobj\n' +
        'xref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000069 00000 n \n0000000139 00000 n \n0000000249 00000 n \n' +
        'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n470\n%%EOF';

      const blob = new Blob([samplePdfContent], { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('title', 'OOP Principles Lecture Slides');
      formData.append('file', blob as any, 'oop_lecture_notes.pdf');

      await documentApi.uploadDocument(formData);
      Alert.alert(
        'Demo PDF Uploaded',
        'Sample OOP lecture notes uploaded! AI background text extraction and summarization is now running.'
      );
      await fetchDocuments();
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Could not upload sample document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateTextDocument = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your document.');
      return;
    }
    if (!newContent.trim() || newContent.trim().length < 5) {
      Alert.alert('Missing Content', 'Please enter at least a few sentences of study text or syllabus.');
      return;
    }

    try {
      setIsCreatingTextDoc(true);
      await documentApi.createDocument({
        title: newTitle.trim(),
        content: newContent.trim(),
      });
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewContent('');
      Alert.alert('Document Created', 'Your document was saved and AI generated an executive summary!');
      await fetchDocuments();
    } catch (err: any) {
      Alert.alert('Creation Failed', err?.message || 'Could not create document.');
    } finally {
      setIsCreatingTextDoc(false);
    }
  };

  const handleDelete = async (docId: string) => {
    Alert.alert('Delete Document', 'Are you sure you want to delete this PDF and its AI summaries?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await documentApi.deleteDocument(docId);
            setDocuments((prev) => prev.filter((d) => d.id !== docId));
            if (selectedDoc?.id === docId) setSelectedDoc(null);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete document.');
          }
        },
      },
    ]);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore' as never);
    }
  };

  const handleGenerateQuizFromDoc = (doc: Document) => {
    router.push({
      pathname: '/quizzes',
      params: {
        docTitle: doc.title,
        docId: doc.id,
      },
    } as never);
  };

  const handleCreateFlashcardsFromDoc = (doc: Document) => {
    router.push('/flashcards' as never);
  };

  const handleShareExcerpt = async (doc: Document) => {
    try {
      const message = `${doc.title}\n\nAI Summary:\n${doc.summary_tldr || 'No summary available.'}\n\nStudyMate AI Course Vault`;
      await Share.share({
        title: doc.title,
        message,
      });
    } catch {
      // User cancelled share
    }
  };

  // Selected doc key concepts helper
  const selectedDocConcepts = useMemo(() => {
    if (!selectedDoc) return [];
    if (Array.isArray(selectedDoc.summary_key_concepts)) {
      return selectedDoc.summary_key_concepts;
    }
    if (
      typeof selectedDoc.summary_key_concepts === 'object' &&
      selectedDoc.summary_key_concepts !== null
    ) {
      return Object.values(selectedDoc.summary_key_concepts);
    }
    return [];
  }, [selectedDoc]);

  return (
    <ScreenWrapper includeTopInset includeBottomInset scrollable={false}>
      {/* ==================================================================== */}
      {/* Top Header Bar                                                       */}
      {/* ==================================================================== */}
      <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
        <TouchableOpacity
          onPress={handleBack}
          accessibilityLabel="Go back"
          style={[
            styles.backButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.borderSubtle,
            },
          ]}>
          <Text style={[styles.backIcon, { color: theme.brandPrimary }]}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <ThemedText
            type="smallBold"
            style={{ color: theme.brandPrimary, letterSpacing: 0.8 }}>
            AI KNOWLEDGE VAULT
          </ThemedText>
          <ThemedText type="headlineMedium" numberOfLines={1}>
            Course Documents
          </ThemedText>
        </View>

        <TouchableOpacity
          onPress={fetchDocuments}
          accessibilityLabel="Refresh documents"
          style={[
            styles.refreshButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.borderSubtle,
            },
          ]}>
          <Text style={{ fontSize: 16 }}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* ==================================================================== */}
      {/* Documents List (with Scrollable Header Content)                      */}
      {/* ==================================================================== */}
      <FlatList
        data={filteredAndSortedDocs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={fetchDocuments}
        ListHeaderComponent={
          <View style={styles.listHeaderWrapper}>
            {/* Hero AI Vault Pulse Card */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.brandPrimary + '35',
                },
              ]}>
              <View style={styles.heroTopRow}>
                <View
                  style={[
                    styles.heroBadge,
                    {
                      backgroundColor: theme.brandPrimary + '18',
                      borderColor: theme.brandPrimary + '35',
                    },
                  ]}>
                  <Text style={{ fontSize: 12 }}>🧠</Text>
                  <ThemedText
                    type="smallBold"
                    style={{
                      color: theme.brandPrimary,
                      fontSize: 11,
                      letterSpacing: 0.6,
                    }}>
                    OCR & AI SUMMARIZER
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.retentionPill,
                    {
                      backgroundColor: theme.statusSuccess + '18',
                      borderColor: theme.statusSuccess + '35',
                    },
                  ]}>
                  <View
                    style={[styles.pulseDot, { backgroundColor: theme.statusSuccess }]}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: theme.statusSuccess,
                      fontSize: 11,
                      fontWeight: '700',
                    }}>
                    AI Active
                  </ThemedText>
                </View>
              </View>

              <ThemedText type="headlineMedium" style={styles.heroTitle}>
                University Lecture Knowledge Hub
              </ThemedText>
              <ThemedText
                type="bodySmall"
                style={{ color: theme.textSecondary, lineHeight: 18 }}>
                Upload slides, syllabi, or exam notes. AI extracts text, generates Cornell notes, and prepares practice quizzes.
              </ThemedText>

              {/* Metrics Grid */}
              <View
                style={[
                  styles.heroMetricsGrid,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.borderSubtle,
                  },
                ]}>
                <View style={styles.heroMetricItem}>
                  <ThemedText
                    type="titleMedium"
                    style={{ color: theme.brandPrimary, fontWeight: '800' }}>
                    {documents.length}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, fontSize: 11 }}>
                    📑 Docs
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.heroMetricDivider,
                    { backgroundColor: theme.borderSubtle },
                  ]}
                />

                <View style={styles.heroMetricItem}>
                  <ThemedText
                    type="titleMedium"
                    style={{ color: theme.text, fontWeight: '800' }}>
                    {totalPagesCount}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, fontSize: 11 }}>
                    📄 Pages
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.heroMetricDivider,
                    { backgroundColor: theme.borderSubtle },
                  ]}
                />

                <View style={styles.heroMetricItem}>
                  <ThemedText
                    type="titleMedium"
                    style={{ color: theme.statusSuccess, fontWeight: '800' }}>
                    {readyDocsCount}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, fontSize: 11 }}>
                    ⚡ AI Ready
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Quick Ingestion Action Buttons Bar */}
            <View style={styles.actionBar}>
              <Button
                title={isUploading ? 'Uploading...' : '📁 Upload PDF'}
                variant="primary"
                size="sm"
                loading={isUploading}
                onPress={handlePickAndUploadPDF}
                style={{ flex: 1.1 }}
              />
              <Button
                title="✍️ Create Doc"
                variant="secondary"
                size="sm"
                onPress={() => setIsCreateModalOpen(true)}
                style={{ flex: 1 }}
              />
              <Button
                title="⚡ Demo PDF"
                variant="ghost"
                size="sm"
                loading={isUploading}
                onPress={handleUploadDemoPDF}
                style={{ flex: 0.9 }}
              />
            </View>

            {/* Search Input with Clear Button */}
            <Input
              placeholder="Search documents, topics, or files..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              showClearButton={Boolean(searchQuery)}
              onClear={() => setSearchQuery('')}
              leftElement={<Text style={{ fontSize: 15, marginRight: 6 }}>🔍</Text>}
              containerStyle={styles.searchInput}
            />

            {/* Status & Sort Chips Row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}>
              {/* Status Chips */}
              <Pressable
                onPress={() => setStatusFilter('all')}
                accessibilityRole="button"
                accessibilityLabel="Show all documents"
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      statusFilter === 'all'
                        ? theme.brandPrimary
                        : theme.cardBackground,
                    borderColor:
                      statusFilter === 'all'
                        ? theme.brandPrimary
                        : theme.borderSubtle,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{
                    color: statusFilter === 'all' ? '#FFFFFF' : theme.textSecondary,
                    fontSize: 11,
                  }}>
                  All ({documents.length})
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => setStatusFilter('ready')}
                accessibilityRole="button"
                accessibilityLabel="Filter ready documents"
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      statusFilter === 'ready'
                        ? theme.statusSuccess + '20'
                        : theme.cardBackground,
                    borderColor:
                      statusFilter === 'ready'
                        ? theme.statusSuccess
                        : theme.borderSubtle,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{
                    color:
                      statusFilter === 'ready'
                        ? theme.statusSuccess
                        : theme.textSecondary,
                    fontSize: 11,
                  }}>
                  ✓ Ready ({readyDocsCount})
                </ThemedText>
              </Pressable>

              {processingDocsCount > 0 ? (
                <Pressable
                  onPress={() => setStatusFilter('processing')}
                  accessibilityRole="button"
                  accessibilityLabel="Filter processing documents"
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        statusFilter === 'processing'
                          ? theme.statusWarning + '20'
                          : theme.cardBackground,
                      borderColor:
                        statusFilter === 'processing'
                          ? theme.statusWarning
                          : theme.borderSubtle,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{
                      color:
                        statusFilter === 'processing'
                          ? theme.statusWarning
                          : theme.textSecondary,
                      fontSize: 11,
                    }}>
                    ⏳ Processing ({processingDocsCount})
                  </ThemedText>
                </Pressable>
              ) : null}

              {/* Sort Chips */}
              <Pressable
                onPress={() => setSortMode('recent')}
                accessibilityRole="button"
                accessibilityLabel="Sort by recent"
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      sortMode === 'recent'
                        ? theme.brandPrimary + '20'
                        : theme.cardBackground,
                    borderColor:
                      sortMode === 'recent'
                        ? theme.brandPrimary
                        : theme.borderSubtle,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{
                    color:
                      sortMode === 'recent'
                        ? theme.brandPrimary
                        : theme.textSecondary,
                    fontSize: 11,
                  }}>
                  🕒 Recent
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => setSortMode('title')}
                accessibilityRole="button"
                accessibilityLabel="Sort by document title"
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      sortMode === 'title'
                        ? theme.brandPrimary + '20'
                        : theme.cardBackground,
                    borderColor:
                      sortMode === 'title'
                        ? theme.brandPrimary
                        : theme.borderSubtle,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{
                    color:
                      sortMode === 'title'
                        ? theme.brandPrimary
                        : theme.textSecondary,
                    fontSize: 11,
                  }}>
                  🔤 Title A-Z
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => setSortMode('pages')}
                accessibilityRole="button"
                accessibilityLabel="Sort by most pages"
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      sortMode === 'pages'
                        ? theme.brandPrimary + '20'
                        : theme.cardBackground,
                    borderColor:
                      sortMode === 'pages'
                        ? theme.brandPrimary
                        : theme.borderSubtle,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{
                    color:
                      sortMode === 'pages'
                        ? theme.brandPrimary
                        : theme.textSecondary,
                    fontSize: 11,
                  }}>
                  📄 Most Pages
                </ThemedText>
              </Pressable>
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="📑"
              title={searchQuery ? 'No matching documents' : 'No documents uploaded yet'}
              description={
                searchQuery
                  ? 'Try searching with a different keyword or clearing filters.'
                  : 'Upload university lecture slides, syllabi, or past exams to get instant AI Cornell notes, summaries, and quizzes.'
              }
              actionLabel="📁 Choose PDF from Device"
              onAction={handlePickAndUploadPDF}
            />
          ) : undefined
        }
        ListFooterComponent={<View style={{ height: 80 }} />}
        renderItem={({ item, index }) => (
          <AnimatedDocCard
            item={item}
            index={index}
            onPress={() => setSelectedDoc(item)}
            onQuizPress={() => handleGenerateQuizFromDoc(item)}
            onDeletePress={() => handleDelete(item.id)}
          />
        )}
      />

      {/* ==================================================================== */}
      {/* Full Document Reader & AI Summary Modal                              */}
      {/* ==================================================================== */}
      <Modal
        visible={Boolean(selectedDoc)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedDoc(null)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.readerModalCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.borderSubtle,
              },
            ]}>
            {/* Reader Header */}
            <View
              style={[
                styles.readerHeader,
                { borderBottomColor: theme.borderSubtle },
              ]}>
              <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13 }}>
                    {selectedDoc?.file_name?.toLowerCase().endsWith('.pdf') ? '📕' : '📝'}
                  </Text>
                  <ThemedText
                    type="smallBold"
                    style={{ color: theme.brandPrimary, letterSpacing: 0.5 }}>
                    AI DOCUMENT READER
                  </ThemedText>
                </View>
                <ThemedText
                  type="titleMedium"
                  numberOfLines={2}
                  style={{ marginTop: 2, fontWeight: '800' }}>
                  {selectedDoc?.title}
                </ThemedText>
                <ThemedText
                  type="bodySmall"
                  style={{ color: theme.textSecondary, fontSize: 11, marginTop: 1 }}>
                  {selectedDoc?.file_name} •{' '}
                  {formatFileSize(selectedDoc?.file_size_bytes || 0)}
                  {selectedDoc?.page_count ? ` • ${selectedDoc.page_count} pages` : ''}
                </ThemedText>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedDoc(null)}
                accessibilityRole="button"
                accessibilityLabel="Close document reader"
                style={[
                  styles.modalCloseBtn,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.borderSubtle,
                  },
                ]}>
                <Text style={{ fontSize: 15, color: theme.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Reader Content */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.readerScrollContent}>
              {/* Status Banner */}
              <View style={styles.readerStatusRow}>
                {selectedDoc?.status === 'ready' ? (
                  <Badge label="✓ AI Analysis Complete" variant="success" size="sm" />
                ) : selectedDoc?.status === 'processing' ? (
                  <Badge label="⚡ Extracting in Background..." variant="warning" size="sm" />
                ) : (
                  <Badge label={selectedDoc?.status || 'Pending'} variant="neutral" size="sm" />
                )}
              </View>

              {/* 1. AI Executive Summary (Cornell Notes) */}
              <View
                style={[
                  styles.readerSectionCard,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.brandPrimary + '35',
                  },
                ]}>
                <View style={styles.readerSectionHeader}>
                  <Text style={{ fontSize: 16 }}>💡</Text>
                  <ThemedText
                    type="smallBold"
                    style={{ color: theme.brandPrimary, fontSize: 13 }}>
                    AI Executive Summary (Cornell Notes)
                  </ThemedText>
                </View>
                <ThemedText
                  type="bodyMedium"
                  style={[styles.readerBodyText, { color: theme.text }]}>
                  {selectedDoc?.summary_tldr ||
                    'AI analysis is currently processing this lecture document. Key formulas, definitions, and exam takeaways will appear here once ready.'}
                </ThemedText>
              </View>

              {/* 2. Key Concepts Extracted */}
              {selectedDocConcepts.length > 0 ? (
                <View
                  style={[
                    styles.readerSectionCard,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.borderSubtle,
                    },
                  ]}>
                  <View style={styles.readerSectionHeader}>
                    <Text style={{ fontSize: 16 }}>🔑</Text>
                    <ThemedText
                      type="smallBold"
                      style={{ color: theme.text, fontSize: 13 }}>
                      Key Concepts Extracted
                    </ThemedText>
                  </View>
                  <View style={styles.readerConceptsGrid}>
                    {selectedDocConcepts.map((concept: any, idx) => {
                      const label =
                        typeof concept === 'string'
                          ? concept
                          : String(concept?.name || concept?.title || concept);
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.conceptPillLarge,
                            {
                              backgroundColor: theme.cardBackground,
                              borderColor: theme.borderSubtle,
                            },
                          ]}>
                          <Text style={{ fontSize: 12 }}>🏷️</Text>
                          <ThemedText
                            type="smallBold"
                            style={{ color: theme.brandPrimary, fontSize: 12 }}>
                            {label}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* 3. Document Excerpt */}
              {selectedDoc?.extracted_text_snippet ? (
                <View
                  style={[
                    styles.readerSectionCard,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.borderSubtle,
                    },
                  ]}>
                  <View style={styles.readerSectionHeader}>
                    <Text style={{ fontSize: 16 }}>📑</Text>
                    <ThemedText
                      type="smallBold"
                      style={{ color: theme.text, fontSize: 13 }}>
                      Extracted Text Excerpt
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="bodySmall"
                    numberOfLines={8}
                    style={{ color: theme.textSecondary, lineHeight: 20 }}>
                    {selectedDoc.extracted_text_snippet}
                  </ThemedText>
                </View>
              ) : null}

              {/* 4. Study Accelerators & Actions */}
              <View style={styles.studyAcceleratorsSection}>
                <ThemedText
                  type="smallBold"
                  style={{
                    color: theme.textTertiary,
                    letterSpacing: 0.6,
                    marginBottom: 6,
                  }}>
                  STUDY ACCELERATORS
                </ThemedText>

                <View style={{ gap: Spacing.sm }}>
                  <Button
                    title="⚡ Practice AI Quiz from Document"
                    variant="primary"
                    size="md"
                    onPress={() => {
                      if (selectedDoc) {
                        const doc = selectedDoc;
                        setSelectedDoc(null);
                        handleGenerateQuizFromDoc(doc);
                      }
                    }}
                    accessibilityLabel="Launch AI quiz for this document"
                  />

                  <Button
                    title="🎴 Review Course Flashcards"
                    variant="secondary"
                    size="md"
                    onPress={() => {
                      if (selectedDoc) {
                        const doc = selectedDoc;
                        setSelectedDoc(null);
                        handleCreateFlashcardsFromDoc(doc);
                      }
                    }}
                    accessibilityLabel="Open flashcards for this document"
                  />

                  {selectedDoc?.summary_tldr ? (
                    <Button
                      title="📤 Share AI Summary"
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        if (selectedDoc) {
                          handleShareExcerpt(selectedDoc);
                        }
                      }}
                      accessibilityLabel="Share summary text"
                    />
                  ) : null}

                  <Button
                    title="🗑️ Delete Document"
                    variant="danger"
                    size="sm"
                    onPress={() => {
                      if (selectedDoc) {
                        const id = selectedDoc.id;
                        handleDelete(id);
                      }
                    }}
                    accessibilityLabel="Delete document"
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================================================================== */}
      {/* Modal for Creating Text/Syllabus Document                            */}
      {/* ==================================================================== */}
      <Modal
        visible={isCreateModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCreateModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.borderSubtle,
              },
            ]}>
            <ThemedText type="headlineMedium" style={{ marginBottom: Spacing.xs }}>
              ✍️ Create Study Document
            </ThemedText>
            <ThemedText
              type="bodySmall"
              style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              Type or paste your syllabus, lecture transcription, or study notes. AI will summarize key concepts automatically.
            </ThemedText>

            <ThemedText type="smallBold" style={{ marginBottom: 4 }}>
              Document Title
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.inputBackground,
                  color: theme.text,
                  borderColor: theme.borderSubtle,
                },
              ]}
              placeholder="e.g. Operating Systems Unit 1"
              placeholderTextColor={theme.textTertiary}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <ThemedText
              type="smallBold"
              style={{ marginTop: Spacing.sm, marginBottom: 4 }}>
              Study Material / Lecture Text
            </ThemedText>
            <TextInput
              style={[
                styles.textAreaInput,
                {
                  backgroundColor: theme.inputBackground,
                  color: theme.text,
                  borderColor: theme.borderSubtle,
                },
              ]}
              placeholder="Paste study text, definitions, or syllabus points here..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={newContent}
              onChangeText={setNewContent}
            />

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancel"
                variant="ghost"
                size="sm"
                onPress={() => setIsCreateModalOpen(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title={isCreatingTextDoc ? 'Creating...' : 'Create & Analyze'}
                variant="primary"
                size="sm"
                loading={isCreatingTextDoc}
                onPress={handleCreateTextDocument}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  backButton: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
  },
  refreshButton: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeaderWrapper: {
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  heroCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.2,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginBottom: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  retentionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroTitle: {
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 23,
    marginTop: 2,
  },
  heroMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginTop: 6,
  },
  heroMetricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  heroMetricDivider: {
    width: 1,
    height: 28,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginVertical: 4,
  },
  searchInput: {
    marginBottom: 2,
  },
  filterChipsRow: {
    gap: Spacing.xs,
    paddingVertical: 4,
    marginBottom: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 80,
  },
  docCard: {
    padding: 0,
    overflow: 'hidden',
    flexDirection: 'row',
    borderRadius: BorderRadius.xl,
    borderWidth: 1.2,
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardAccentBarWrapper: {
    width: 6,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.85,
  },
  cardAccentDot: {
    width: 6,
    height: 14,
    borderRadius: 3,
  },
  cardInnerContent: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  cardBadgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  fileTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  pageCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 21,
    marginTop: 2,
  },
  summaryPreviewBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: 3,
    marginTop: 2,
  },
  summaryPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryPreviewText: {
    lineHeight: 18,
    fontSize: 12,
  },
  conceptsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  conceptPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  readPillBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  footerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickQuizBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    elevation: 2,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  cardDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  readerModalCard: {
    width: '100%',
    maxHeight: '88%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  readerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerScrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  readerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readerSectionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  readerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  readerBodyText: {
    lineHeight: 22,
    fontSize: 14,
  },
  readerConceptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  conceptPillLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  studyAcceleratorsSection: {
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  modalCard: {
    width: '92%',
    maxWidth: 480,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: Spacing.xxl,
  },
  textInput: {
    height: 44,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
  },
  textAreaInput: {
    height: 120,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.sm,
    fontSize: 14,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.md,
  },
});
