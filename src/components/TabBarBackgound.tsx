import { StyleSheet, View } from 'react-native';
import React, { memo } from 'react';
import LinearGradient from 'react-native-linear-gradient';

const TabBarBackgound = () => {
  return (
    <>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
      />
      <LinearGradient
        colors={[
          'rgba(0, 0, 0, 0.0)',
          'rgba(0, 0, 0, 0.3)',
          'rgba(0, 0, 0, 0.5)',
          'rgba(0, 0, 0, 0.8)',
          'rgba(0, 0, 0, 1)',
        ]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
    </>
  );
};

export default memo(TabBarBackgound);
