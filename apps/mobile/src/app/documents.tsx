import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, ScreenWrapper } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
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

export default function DocumentsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <Badge label="Ready" variant="success" size="sm" />;
      case 'processing':
        return <Badge label="AI Processing..." variant="warning" size="sm" />;
      case 'failed':
        return <Badge label="Failed" variant="danger" size="sm" />;
      default:
        return <Badge label="Pending" variant="neutral" size="sm" />;
    }
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

  return (
    <ScreenWrapper includeTopInset includeBottomInset scrollable={false}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
        <TouchableOpacity
          onPress={handleBack}
          accessibilityLabel="Go back"
          style={styles.backButton}>
          <Text style={[styles.backIcon, { color: theme.text }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <ThemedText type="headlineMedium">Course Documents</ThemedText>
          <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
            PDF Lecture Slides & AI Summaries
          </ThemedText>
        </View>
        <TouchableOpacity
          onPress={fetchDocuments}
          accessibilityLabel="Refresh documents"
          style={styles.refreshButton}>
          <Text style={{ fontSize: 18 }}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Action Bar */}
      <View style={[styles.actionBar, { borderBottomColor: theme.borderSubtle }]}>
        <Button
          title={isUploading ? 'Uploading...' : '📁 Upload PDF'}
          variant="primary"
          size="sm"
          loading={isUploading}
          onPress={handlePickAndUploadPDF}
          style={{ flex: 1, marginRight: Spacing.xs }}
        />
        <Button
          title="✍️ Create Doc"
          variant="secondary"
          size="sm"
          onPress={() => setIsCreateModalOpen(true)}
          style={{ flex: 1, marginRight: Spacing.xs }}
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

      {/* Documents List */}
      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={fetchDocuments}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 44, marginBottom: Spacing.sm }}>📑</Text>
              <ThemedText type="titleMedium" style={{ textAlign: 'center' }}>
                No Documents Uploaded Yet
              </ThemedText>
              <ThemedText
                type="bodyMedium"
                style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.xs }}>
                Upload lecture slides, syllabus, or create study documents to get AI-generated Cornell notes, executive summaries, and active recall practice.
              </ThemedText>

              <View style={styles.emptyButtonContainer}>
                <Button
                  title={isUploading ? 'Uploading...' : '📁 Choose PDF from Device'}
                  variant="primary"
                  size="md"
                  loading={isUploading}
                  onPress={handlePickAndUploadPDF}
                  style={{ width: '100%', marginBottom: Spacing.sm }}
                />
                <Button
                  title="✍️ Create Document from Text"
                  variant="secondary"
                  size="md"
                  onPress={() => setIsCreateModalOpen(true)}
                  style={{ width: '100%', marginBottom: Spacing.sm }}
                />
                <Button
                  title="⚡ Upload Sample Lecture PDF"
                  variant="ghost"
                  size="md"
                  loading={isUploading}
                  onPress={handleUploadDemoPDF}
                  style={{ width: '100%' }}
                />
              </View>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const isSelected = selectedDoc?.id === item.id;
          const keyConcepts = Array.isArray(item.summary_key_concepts)
            ? item.summary_key_concepts
            : typeof item.summary_key_concepts === 'object' && item.summary_key_concepts !== null
              ? Object.values(item.summary_key_concepts)
              : [];

          return (
            <Card
              variant="default"
              style={[
                styles.docCard,
                isSelected && { borderColor: theme.brandPrimary, borderWidth: 2 },
              ]}
              onPress={() => setSelectedDoc(isSelected ? null : item)}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={{ fontSize: 24 }}>📄</Text>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="titleMedium" numberOfLines={1}>
                      {item.title}
                    </ThemedText>
                    <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                      {item.file_name} • {(item.file_size_bytes / 1024).toFixed(0)} KB
                      {item.page_count ? ` • ${item.page_count} pages` : ''}
                    </ThemedText>
                  </View>
                </View>
                {getStatusBadge(item.status)}
              </View>

              {/* Expanded AI Summary & Document Details View */}
              {isSelected && (
                <View style={[styles.expandedContent, { borderTopColor: theme.borderSubtle }]}>
                  {item.summary_tldr ? (
                    <View style={styles.summaryBlock}>
                      <ThemedText type="smallBold" style={{ color: theme.brandPrimary }}>
                        💡 AI Executive Summary (Cornell Notes)
                      </ThemedText>
                      <ThemedText type="bodyMedium" style={{ marginTop: 4 }}>
                        {item.summary_tldr}
                      </ThemedText>
                    </View>
                  ) : null}

                  {keyConcepts.length > 0 ? (
                    <View style={{ marginTop: Spacing.xs }}>
                      <ThemedText type="smallBold" style={{ color: theme.textSecondary, marginBottom: 4 }}>
                        🔑 Key Concepts Extracted:
                      </ThemedText>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {keyConcepts.slice(0, 6).map((c: any, i) => (
                          <Badge
                            key={i}
                            label={typeof c === 'string' ? c : String(c?.name || c?.title || c)}
                            variant="brand"
                            size="sm"
                          />
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {item.extracted_text_snippet ? (
                    <View style={{ marginTop: Spacing.xs, backgroundColor: theme.surfaceSubtle, padding: Spacing.sm, borderRadius: BorderRadius.sm }}>
                      <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
                        📑 Document Excerpt:
                      </ThemedText>
                      <ThemedText type="bodySmall" numberOfLines={4} style={{ marginTop: 2, color: theme.textSecondary }}>
                        {item.extracted_text_snippet}
                      </ThemedText>
                    </View>
                  ) : null}

                  {/* Document Actions Row */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => handleGenerateQuizFromDoc(item)}
                      accessibilityLabel="Generate quiz from this document"
                      style={[styles.quizBtn, { backgroundColor: theme.brandPrimary }]}>
                      <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>
                        ⚡ Practice AI Quiz
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDelete(item.id)}
                      accessibilityLabel="Delete document"
                      style={styles.deleteBtn}>
                      <Text style={{ color: theme.statusDanger, fontSize: 13, fontWeight: '600' }}>
                        🗑️ Delete PDF
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Card>
          );
        }}
      />

      {/* Modal for Creating Text/Syllabus Document */}
      <Modal
        visible={isCreateModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCreateModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.borderSubtle }]}>
            <ThemedText type="headlineMedium" style={{ marginBottom: Spacing.xs }}>
              ✍️ Create Study Document
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              Type or paste your syllabus, lecture transcription, or study notes. AI will summarize key concepts automatically.
            </ThemedText>

            <ThemedText type="smallBold" style={{ marginBottom: 4 }}>
              Document Title
            </ThemedText>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.surfaceSubtle, color: theme.text, borderColor: theme.borderSubtle }]}
              placeholder="e.g. Operating Systems Unit 1"
              placeholderTextColor={theme.textTertiary}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <ThemedText type="smallBold" style={{ marginTop: Spacing.sm, marginBottom: 4 }}>
              Study Material / Lecture Text
            </ThemedText>
            <TextInput
              style={[
                styles.textAreaInput,
                { backgroundColor: theme.surfaceSubtle, color: theme.text, borderColor: theme.borderSubtle },
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
    padding: Spacing.xs,
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerTitleContainer: {
    flex: 1,
  },
  refreshButton: {
    padding: Spacing.xs,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  docCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  expandedContent: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  summaryBlock: {
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  quizBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
  },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 1.5,
    paddingHorizontal: Spacing.lg,
  },
  emptyButtonContainer: {
    width: '100%',
    marginTop: Spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
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
    marginTop: Spacing.lg,
  },
});
