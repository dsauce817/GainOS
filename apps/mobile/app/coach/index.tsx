// GainOS AI Coach Chat Screen
// iMessage-style chat with personalized coaching

import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "../../store/auth";
import { supabase } from "../../lib/supabase";
import type { AIMessage, AIConversation } from "@gainos/db";

const SUGGESTED_PROMPTS = [
  "How is my training this week?",
  "Am I hitting enough volume for each muscle group?",
  "What should I focus on today?",
  "Do I need a deload week?",
  "How can I improve my squat?",
  "What are my calorie and protein targets?",
  "Give me a summary of my progress this month",
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
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId,
            message: text.trim(),
          }),
        }
      );

      if (!response.ok) throw new Error("Coach unavailable");

      const data = await response.json();

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
    } catch (err) {
      Alert.alert(
        "Coach unavailable",
        "Check your connection and try again."
      );
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [conversationId, isTyping]);

  const renderMessage = ({ item }: { item: AIMessage }) => {
    const isUser = item.role === "user";

    return (
      <View style={[styles.messageBubbleRow, isUser && styles.messageBubbleRowUser]}>
        {!isUser && (
          <View style={styles.coachAvatar}>
            <Text style={styles.coachAvatarText}>🤖</Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.messageBubbleUser : styles.messageBubbleCoach,
          ]}
        >
          <Text style={[styles.messageText, isUser && styles.messageTextUser]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isUser && styles.messageTimeUser]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => setShowConversations(!showConversations)}
        >
          <View style={styles.coachHeaderAvatar}>
            <Text style={styles.coachHeaderAvatarText}>🤖</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>GainOS Coach</Text>
            <Text style={styles.headerSubtitle}>
              {isTyping ? "Typing..." : "AI Personal Trainer"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={startNewConversation} style={styles.newChatBtn}>
          <Text style={styles.newChatText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Conversation History Dropdown */}
      {showConversations && (
        <View style={styles.convDropdown}>
          <TouchableOpacity style={styles.convNewItem} onPress={startNewConversation}>
            <Text style={styles.convNewText}>+ New Conversation</Text>
          </TouchableOpacity>
          {conversations.map((conv) => (
            <TouchableOpacity
              key={conv.id}
              style={styles.convItem}
              onPress={() => loadConversation(conv.id)}
            >
              <Text style={styles.convItemTitle} numberOfLines={1}>
                {conv.title || "Chat"}
              </Text>
              <Text style={styles.convItemDate}>
                {new Date(conv.updated_at).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>🤖</Text>
          <Text style={styles.emptyStateTitle}>Your AI Coach</Text>
          <Text style={styles.emptyStateSubtitle}>
            I know your workouts, progress, and goals. Ask me anything.
          </Text>

          <View style={styles.suggestedPrompts}>
            {SUGGESTED_PROMPTS.slice(0, 4).map((prompt, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestedPrompt}
                onPress={() => sendMessage(prompt)}
              >
                <Text style={styles.suggestedPromptText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingIndicator}>
                <View style={styles.coachAvatar}>
                  <Text style={styles.coachAvatarText}>🤖</Text>
                </View>
                <View style={styles.typingBubble}>
                  <ActivityIndicator size="small" color="#6366f1" />
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Suggested prompts when messages exist */}
      {messages.length > 0 && !isTyping && (
        <View style={styles.quickPrompts}>
          {SUGGESTED_PROMPTS.slice(0, 3).map((prompt, i) => (
            <TouchableOpacity
              key={i}
              style={styles.quickPrompt}
              onPress={() => sendMessage(prompt)}
            >
              <Text style={styles.quickPromptText} numberOfLines={1}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask your coach..."
            placeholderTextColor="#6b7280"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(inputText)}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isTyping}
          >
            <LinearGradient
              colors={["#6366f1", "#8b5cf6"]}
              style={styles.sendBtnGradient}
            >
              <Text style={styles.sendBtnText}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatTime(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0b" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1e",
    gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { color: "#6366f1", fontSize: 28, fontWeight: "300" },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coachHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e1e24",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#6366f1",
  },
  coachHeaderAvatarText: { fontSize: 20 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#f9fafb" },
  headerSubtitle: { fontSize: 12, color: "#6b7280" },
  newChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1e1e24",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  newChatText: { color: "#9ca3af", fontSize: 22, fontWeight: "300" },

  convDropdown: {
    backgroundColor: "#111113",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a32",
    maxHeight: 240,
  },
  convNewItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1e",
  },
  convNewText: { color: "#6366f1", fontSize: 15, fontWeight: "600" },
  convItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1e",
  },
  convItemTitle: { color: "#f9fafb", fontSize: 14, flex: 1 },
  convItemDate: { color: "#6b7280", fontSize: 12 },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  emptyStateEmoji: { fontSize: 64 },
  emptyStateTitle: { fontSize: 24, fontWeight: "800", color: "#f9fafb" },
  emptyStateSubtitle: { fontSize: 15, color: "#9ca3af", textAlign: "center", lineHeight: 22 },
  suggestedPrompts: { width: "100%", gap: 10, marginTop: 8 },
  suggestedPrompt: {
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  suggestedPromptText: { color: "#9ca3af", fontSize: 14 },

  messageList: { padding: 16, gap: 12, paddingBottom: 8 },
  messageBubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 8,
  },
  messageBubbleRowUser: { flexDirection: "row-reverse" },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1e1e24",
    justifyContent: "center",
    alignItems: "center",
  },
  coachAvatarText: { fontSize: 16 },
  messageBubble: {
    maxWidth: "80%",
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  messageBubbleUser: {
    backgroundColor: "#6366f1",
    borderBottomRightRadius: 4,
  },
  messageBubbleCoach: {
    backgroundColor: "#1e1e24",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  messageText: {
    fontSize: 15,
    color: "#f9fafb",
    lineHeight: 22,
  },
  messageTextUser: { color: "#fff" },
  messageTime: { fontSize: 11, color: "#6b7280", alignSelf: "flex-end" },
  messageTimeUser: { color: "#a5b4fc" },

  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  typingBubble: {
    backgroundColor: "#1e1e24",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },

  quickPrompts: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickPrompt: {
    flex: 1,
    backgroundColor: "#111113",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  quickPromptText: { color: "#9ca3af", fontSize: 12 },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1e",
  },
  input: {
    flex: 1,
    backgroundColor: "#1e1e24",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    color: "#f9fafb",
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#2a2a32",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnGradient: { flex: 1, justifyContent: "center", alignItems: "center" },
  sendBtnText: { color: "#fff", fontSize: 20, fontWeight: "700" },
});
