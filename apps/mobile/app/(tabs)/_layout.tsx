import { useEffect } from "react";
import { Tabs, Redirect } from "expo-router";
import { StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useAuthStore } from "../../store/auth";

function AnimatedIcon({
  name,
  focusedName,
  focused,
  color,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  focusedName: React.ComponentProps<typeof Ionicons>["name"];
  focused: boolean;
  color: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value = withSpring(focused ? 1.2 : 1, { damping: 12, stiffness: 280 });
  }, [focused]);

  return (
    <Animated.View style={animStyle}>
      <Ionicons name={focused ? focusedName : name} size={24} color={color} />
    </Animated.View>
  );
}

function StartButton({ focused }: { focused: boolean }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value = withSpring(focused ? 0.93 : 1, { damping: 12, stiffness: 280 });
  }, [focused]);

  return (
    <Animated.View style={[styles.startOuter, animStyle]}>
      <LinearGradient
        colors={focused ? ["#818cf8", "#6366f1"] : ["#252530", "#1a1a22"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.startInner}
      >
        <Ionicons name="add" size={28} color={focused ? "#fff" : "#6b7280"} />
      </LinearGradient>
    </Animated.View>
  );
}

export default function TabLayout() {
  const { user } = useAuthStore();

  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#818cf8",
        tabBarInactiveTintColor: "#4b5563",
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <AnimatedIcon
              name="home-outline"
              focusedName="home"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <AnimatedIcon
              name="time-outline"
              focusedName="time"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="start"
        options={{
          tabBarIcon: ({ focused }) => <StartButton focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="routines"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <AnimatedIcon
              name="sparkles-outline"
              focusedName="sparkles"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trophies"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <AnimatedIcon
              name="person-outline"
              focusedName="person"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    backgroundColor: "transparent",
    borderTopColor: "rgba(255,255,255,0.07)",
    borderTopWidth: 0.5,
    height: 88,
    paddingBottom: 24,
    paddingTop: 8,
    elevation: 0,
  },
  startOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: "hidden",
    marginBottom: 8,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  startInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
