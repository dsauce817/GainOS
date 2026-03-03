// GainOS AI Coach — Tab Screen
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
import { useAuthStore } from "../../store/auth";
import { supabase } from "../../lib/supabase";
import type { AIMessage, AIConversation } from "@gainos/db";

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
      const errorMessage: AIMessage = {
        id: Date.now().toString() + "_error",
        conversation_id: conversationId || "error",
        role: "assistant",
        content: "Something went wrong. Please try again.",
        tokens_used: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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
            <Ionicons name="sparkles" size={14} color="#818cf8" />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.content}
          </Text>
          <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerLeft}
          onPress={() => setShowConversations(!showConversations)}
        >
          <View style={styles.coachHeaderAvatar}>
            <Ionicons name="sparkles" size={16} color="#818cf8" />
          </View>
          <View>
            <Text style={styles.headerTitle}>GainOS Coach</Text>
            <Text style={styles.headerSub}>
              {isTyping ? "Typing..." : "AI Personal Trainer"}
            </Text>
          </View>
        </Pressable>
        <Pressable style={styles.newChatBtn} onPress={startNewConversation}>
          <Ionicons name="add" size={20} color="#52525b" />
        </Pressable>
      </View>

      {/* Conversation History Dropdown */}
      {showConversations && (
        <View style={styles.convDropdown}>
          <Pressable style={styles.convNewItem} onPress={startNewConversation}>
            <Text style={styles.convNewText}>New Conversation</Text>
          </Pressable>
          {conversations.map((conv) => (
            <Pressable
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
            </Pressable>
          ))}
        </View>
      )}

      {/* Messages or Empty State */}
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyAvatar}>
            <Ionicons name="sparkles" size={28} color="#818cf8" />
          </View>
          <Text style={styles.emptyTitle}>Your AI Coach</Text>
          <Text style={styles.emptySub}>
            I know your workouts, progress, and goals.{"\n"}Ask me anything.
          </Text>
          <View style={styles.promptGrid}>
            {SUGGESTED_PROMPTS.slice(0, 4).map((prompt, i) => (
              <Pressable
                key={i}
                style={styles.promptCard}
                onPress={() => sendMessage(prompt)}
              >
                <Text style={styles.promptText}>{prompt}</Text>
              </Pressable>
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
              <View style={styles.bubbleRow}>
                <View style={styles.coachAvatar}>
                  <Ionicons name="sparkles" size={14} color="#818cf8" />
                </View>
                <View style={styles.typingBubble}>
                  <ActivityIndicator size="small" color="#818cf8" />
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Quick prompts when chatting */}
      {messages.length > 0 && !isTyping && (
        <View style={styles.quickPrompts}>
          {SUGGESTED_PROMPTS.slice(0, 3).map((prompt, i) => (
            <Pressable
              key={i}
              style={styles.quickPrompt}
              onPress={() => sendMessage(prompt)}
            >
              <Text style={styles.quickPromptText} numberOfLines={1}>{prompt}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask your coach..."
            placeholderTextColor="#3f3f46"
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

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0b" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  coachHeaderAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(99,102,241,0.12)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.25)",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: "#f4f4f5" },
  headerSub: { fontSize: 12, color: "#52525b" },
  newChatBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },

  convDropdown: {
    backgroundColor: "#111113",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    maxHeight: 240,
  },
  convNewItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  convNewText: { color: "#6366f1", fontSize: 14, fontWeight: "600" },
  convItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  convItemTitle: { color: "#d4d4d8", fontSize: 14, flex: 1 },
  convItemDate: { color: "#52525b", fontSize: 12 },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
    paddingBottom: 100,
  },
  emptyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(99,102,241,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.2)",
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#f4f4f5" },
  emptySub: { fontSize: 14, color: "#52525b", textAlign: "center", lineHeight: 20 },
  promptGrid: { width: "100%", gap: 8, marginTop: 8 },
  promptCard: {
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  promptText: { color: "#71717a", fontSize: 14 },

  messageList: { padding: 16, gap: 8, paddingBottom: 8 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 6 },
  bubbleRowUser: { flexDirection: "row-reverse" },
  coachAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(99,102,241,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  bubble: { maxWidth: "80%", borderRadius: 18, padding: 13, gap: 4 },
  bubbleUser: { backgroundColor: "#6366f1", borderBottomRightRadius: 4 },
  bubbleCoach: {
    backgroundColor: "#111113",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  bubbleText: { fontSize: 15, color: "#d4d4d8", lineHeight: 22 },
  bubbleTextUser: { color: "#fff" },
  bubbleTime: { fontSize: 11, color: "#52525b", alignSelf: "flex-end" },
  bubbleTimeUser: { color: "#a5b4fc" },
  typingBubble: {
    backgroundColor: "#111113",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
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
    borderColor: "rgba(255,255,255,0.07)",
  },
  quickPromptText: { color: "#52525b", fontSize: 12 },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 100,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  input: {
    flex: 1,
    backgroundColor: "#111113",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    color: "#f4f4f5",
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.35 },
});
