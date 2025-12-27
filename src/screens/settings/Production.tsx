// screens/Production.tsx
import {
  View,
  Text,
  TouchableNativeFeedback,
  Linking,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { Feather } from '@expo/vector-icons'; // Import Feather icons
import useThemeStore from '../../lib/zustand/themeStore';
import { productionApps } from '../../lib/constants';
import Animated, { FadeInDown } from 'react-native-reanimated';

const Production = () => {
  const insets = useSafeAreaInsets();
  const { primary } = useThemeStore(state => state);

  const AnimatedSection = ({
    delay,
    children,
  }: {
    delay: number;
    children: React.ReactNode;
  }) => (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}>
      {children}
    </Animated.View>
  );

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <View className="px-4 py-3 border-b border-white/10">
        <Text className="text-2xl font-bold text-white">Our Productions</Text>
        <Text className="text-gray-400 mt-1 text-sm">
          Check out our other amazing apps
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="p-4">
          {/* Echo Pulse Music */}
          <AnimatedSection delay={100}>
            <View className="mb-3">
              <TouchableNativeFeedback
                onPress={() => Linking.openURL(productionApps.app1.url)}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
                  <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center">
                      <Feather name={productionApps.app1.icon} size={22} color={primary} />
                      <Text className="text-white ml-3 text-base">
                        {productionApps.app1.name}
                      </Text>
                    </View>
                    <Feather name="external-link" size={20} color="gray" />
                  </View>
                </View>
              </TouchableNativeFeedback>
            </View>
          </AnimatedSection>

          {/* Doodle Windows */}
          <AnimatedSection delay={200}>
            <View className="mb-3">
              <TouchableNativeFeedback
                onPress={() => Linking.openURL(productionApps.app2.url)}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
                  <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center">
                      <Feather name={productionApps.app2.icon} size={22} color={primary} />
                      <Text className="text-white ml-3 text-base">
                        {productionApps.app2.name}
                      </Text>
                    </View>
                    <Feather name="external-link" size={20} color="gray" />
                  </View>
                </View>
              </TouchableNativeFeedback>
            </View>
          </AnimatedSection>

          {/* Doodle Web Play */}
          <AnimatedSection delay={300}>
            <View className="mb-3">
              <TouchableNativeFeedback
                onPress={() => Linking.openURL(productionApps.app3.url)}
                background={TouchableNativeFeedback.Ripple('#333333', false)}>
                <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
                  <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center">
                      <Feather name={productionApps.app3.icon} size={22} color={primary} />
                      <Text className="text-white ml-3 text-base">
                        {productionApps.app3.name}
                      </Text>
                    </View>
                    <Feather name="external-link" size={20} color="gray" />
                  </View>
                </View>
              </TouchableNativeFeedback>
            </View>
          </AnimatedSection>

          {/* Description */}
          <AnimatedSection delay={400}>
            <View className="bg-[#1A1A1A] rounded-xl p-4">
              <Text className="text-white text-base font-semibold mb-2">
                About Our Apps
              </Text>
              <Text className="text-gray-400 text-sm">
                We create high-quality mobile applications with great user experiences.
                Each app is designed to make your daily tasks easier and more enjoyable.
              </Text>
            </View>
          </AnimatedSection>
        </View>
      </ScrollView>
    </View>
  );
};

export default Production;