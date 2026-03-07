// GainOS Atlas — AI Coach Screen
import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useAuthStore } from "../store/auth";
import { supabase } from "../lib/supabase";
import type { AIMessage, AIConversation } from "@gainos/db";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../constants/theme";

const SUGGESTED_PROMPTS = [
  "How is my training this week?",
  "Am I hitting enough volume for each muscle?",
  "What should I focus on today?",
  "Do I need a deload week?",
  "How can I improve my squat?",
  "Give me a progress summary this month",
];

export default function CoachScreen() {
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const { data } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("user_id", profile!.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    setConversations(data || []);
  };

  const loadConversation = async (convId: string) => {
    setConversationId(convId);
    setShowConversations(false);
    const { data } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMessages((data || []).filter((m: any) => m.role !== "system") as AIMessage[]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setShowConversations(false);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    setInputText("");

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      conversation_id: conversationId || "pending",
      role: "user",
      content: text.trim(),
      tokens_used: null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { conversationId, message: text.trim() },
      });

      if (error) throw new Error(error.message || "Coach unavailable");
      setConversationId(data.conversationId);

      const assistantMessage: AIMessage = {
        id: Date.now().toString() + "_assistant",
        conversation_id: data.conversationId,
        role: "assistant",
        content: data.message,
        tokens_used: data.tokensUsed,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      loadConversations();
    } catch {
      setMessages((prev) => [...prev, {
        id: Date.now().toString() + "_error",
        conversation_id: conversationId || "error",
        role: "assistant",
        content: "Something went wrong. Please try again.",
        tokens_used: null,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [conversationId, isTyping]);

  const renderMessage = ({ item }: { item: AIMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
        {!isUser && (
          <View style={styles.coachAvatar}>
            <Ionicons name="sparkles" size={14} color={Colors.accentLight} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.content}</Text>
          <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View
        style={styles.header}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>

        <Pressable
          style={styles.headerCenter}
          onPress={() => setShowConversations(!showConversations)}
        >
          <View style={styles.coachHeaderAvatar}>
            <Ionicons name="sparkles" size={16} color={Colors.accentLight} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Atlas</Text>
            <Text style={styles.headerSub}>
              {isTyping ? "Typing..." : "AI Personal Trainer"}
            </Text>
          </View>
          <Ionicons
            name={showConversations ? "chevron-up" : "chevron-down"}
            size={14}
            color={Colors.textMuted}
          />
        </Pressable>

        <Pressable style={styles.newChatBtn} onPress={startNewConversation}>
          <Ionicons name="add" size={20} color={Colors.textMuted} />
        </Pressable>
      </View>

      {showConversations && (
        <Pressable
          style={[styles.backdrop, { top: headerHeight + insets.top }]}
          onPress={() => setShowConversations(false)}
        />
      )}

      {showConversations && (
        <View style={[styles.convDropdown, { top: headerHeight + insets.top }]}>
          <Pressable style={styles.convNewItem} onPress={startNewConversation}>
            <Text style={styles.convNewText}>New Conversation</Text>
          </Pressable>
          <FlatList
            data={conversations.slice(0, 20)}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 260 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable style={styles.convItem} onPress={() => loadConversation(item.id)}>
                <Text style={styles.convItemTitle} numberOfLines={1}>{item.title || "Chat"}</Text>
                <Text style={styles.convItemDate}>
                  {new Date(item.updated_at).toLocaleDateString()}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: messages.length > 0 ? 16 : 0 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyAvatar}>
              <Ionicons name="sparkles" size={28} color={Colors.accentLight} />
            </View>
            <Text style={styles.emptyTitle}>Atlas</Text>
            <Text style={styles.emptySub}>
              I know your workouts, progress, and goals.{"\n"}Ask me anything.
            </Text>
            <View style={styles.promptGrid}>
              {SUGGESTED_PROMPTS.slice(0, 6).map((prompt, i) => (
                <Pressable key={i} style={styles.promptCard} onPress={() => sendMessage(prompt)}>
                  <Text style={styles.promptText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={
          isTyping ? (
            <View style={styles.bubbleRow}>
              <View style={styles.coachAvatar}>
                <Ionicons name="sparkles" size={14} color={Colors.accentLight} />
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color={Colors.accentLight} />
              </View>
            </View>
          ) : null
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {messages.length > 0 && !isTyping && (
        <View style={styles.quickPrompts}>
          {SUGGESTED_PROMPTS.slice(0, 3).map((prompt, i) => (
            <Pressable key={i} style={styles.quickPrompt} onPress={() => sendMessage(prompt)}>
              <Text style={styles.quickPromptText} numberOfLines={1}>{prompt}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask Atlas..."
            placeholderTextColor={Colors.textFaint}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(inputText)}
            blurOnSubmit
          />
          <Pressable
            style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isTyping}
          >
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, position: "relative" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  coachHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(63,209,122,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary },
  headerSub: { fontSize: 12, color: Colors.textMuted },
  newChatBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.borderFaint,
    justifyContent: "center",
    alignItems: "center",
  },
  convDropdown: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: Colors.bgCard,
    maxHeight: 300,
    zIndex: 100,
    elevation: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  convNewItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderFaint },
  convNewText: { color: Colors.accent, fontSize: 14, fontWeight: "600" },
  convItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderFaint,
  },
  convItemTitle: { color: Colors.textLight, fontSize: 14, flex: 1 },
  convItemDate: { color: Colors.textMuted, fontSize: 12 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "flex-start", padding: 32, gap: 12 },
  emptyAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(63,209,122,0.12)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: "center", lineHeight: 20 },
  promptGrid: { width: "100%", gap: 8, marginTop: 8 },
  promptCard: {
    backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14,
  },
  promptText: { color: Colors.textMid, fontSize: 14 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 6 },
  bubbleRowUser: { flexDirection: "row-reverse" },
  coachAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(163,230,53,0.12)",
    justifyContent: "center", alignItems: "center",
  },
  bubble: { maxWidth: "80%", borderRadius: 18, padding: 13, gap: 4 },
  bubbleUser: { backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  bubbleCoach: {
    backgroundColor: Colors.bgCard, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  bubbleText: { fontSize: 15, color: Colors.textLight, lineHeight: 22 },
  bubbleTextUser: { color: "#fff" },
  bubbleTime: { fontSize: 11, color: Colors.textMuted, alignSelf: "flex-end" },
  bubbleTimeUser: { color: Colors.accentLighter },
  typingBubble: {
    backgroundColor: Colors.bgCard, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  quickPrompts: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  quickPrompt: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: 10, padding: 10,
  },
  quickPromptText: { color: Colors.textMuted, fontSize: 12 },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)",
  },
  input: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    color: Colors.textPrimary, fontSize: 15, maxHeight: 120,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accent, justifyContent: "center", alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.35 },
  backdrop: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.overlayLight, zIndex: 50,
  },
});
