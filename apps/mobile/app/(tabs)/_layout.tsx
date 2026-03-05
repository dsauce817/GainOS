import { useEffect } from "react";
import { Tabs, Redirect } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useAuthStore } from "../../store/auth";
import { Colors } from "../../constants/theme";

function AnimatedIcon({
  name,
  focusedName,
  focused,
  color,
  label,
  size = 26,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  focusedName: React.ComponentProps<typeof Ionicons>["name"];
  focused: boolean;
  color: string;
  label: string;
  size?: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value = withSpring(focused ? 1.08 : 1, { damping: 12, stiffness: 280 });
  }, [focused]);

  return (
    <Animated.View style={[styles.iconWrapper, animStyle]}>
      <Ionicons name={focused ? focusedName : name} size={size} color={color} />
      <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>{label}</Text>
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
        tabBarActiveTintColor: Colors.accentLight,
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
              label="Home"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <AnimatedIcon
              name="stats-chart-outline"
              focusedName="stats-chart"
              focused={focused}
              color={color}
              label="Progress"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <AnimatedIcon
              name="add-circle-outline"
              focusedName="add-circle"
              focused={focused}
              color={color}
              label="Workouts"
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <AnimatedIcon
              name="barbell-outline"
              focusedName="barbell"
              focused={focused}
              color={color}
              label="Exercises"
            />
          ),
        }}
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
              label="Profile"
            />
          ),
        }}
      />
      <Tabs.Screen name="routines" options={{ href: null }} />
      <Tabs.Screen name="trophies" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "transparent",
    borderTopColor: Colors.borderSubtle,
    borderTopWidth: 0.5,
    height: 88,
    paddingBottom: 20,
    paddingTop: 8,
    elevation: 0,
  },
  iconWrapper: {
    alignItems: "center",
    gap: 3,
    width: 64,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
});
