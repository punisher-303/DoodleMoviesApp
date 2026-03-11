import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, Text, View, StyleSheet, Easing } from 'react-native';

interface MarqueeTextProps {
  text: string;
  style?: any;
  speed?: number; // lower is slower
  delay?: number;
}

const MarqueeText: React.FC<MarqueeTextProps> = ({ text, style, speed = 50, delay = 2000 }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const contentWidth = useRef(0);
  const containerWidth = useRef(0);

  const startAnimation = () => {
    if (contentWidth.current <= containerWidth.current) return;

    const scrollDistance = contentWidth.current - containerWidth.current;
    const duration = scrollDistance * speed;

    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(scrollX, {
        toValue: scrollDistance,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.delay(delay),
      Animated.timing(scrollX, {
        toValue: 0,
        duration: duration / 2, // Return faster
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => startAnimation());
  };

  useEffect(() => {
      // Small timeout to ensure layout is captured
      const t = setTimeout(() => {
          if (contentWidth.current > containerWidth.current) {
              startAnimation();
          }
      }, 500);
      return () => {
          clearTimeout(t);
          scrollX.stopAnimation();
      };
  }, [text]);

  return (
    <View 
        style={[styles.container, style]} 
        onLayout={(e) => { containerWidth.current = e.nativeEvent.layout.width; }}
    >
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={{ alignItems: 'center' }}
        style={{ transform: [{ translateX: Animated.multiply(scrollX, -1) }] }}
      >
        <Text
          onLayout={(e) => { contentWidth.current = e.nativeEvent.layout.width; }}
          style={[style, { whiteSpace: 'nowrap' }]}
        >
          {text}
        </Text>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    flexDirection: 'row',
  },
});

export default MarqueeText;
