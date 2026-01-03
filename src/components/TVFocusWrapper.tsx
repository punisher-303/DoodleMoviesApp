import React, { useState } from 'react';
import { TouchableOpacity, StyleProp, ViewStyle, Animated, GestureResponderEvent, TouchableOpacityProps, Platform } from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';

interface TVFocusWrapperProps extends TouchableOpacityProps {
    children: React.ReactNode;
    focusedStyle?: StyleProp<ViewStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    onFocus?: () => void;
    onBlur?: () => void;
}

const TVFocusWrapper: React.FC<TVFocusWrapperProps> = ({
    children,
    style,
    focusedStyle,
    containerStyle,
    onFocus,
    onBlur,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [scale] = useState(new Animated.Value(1));

    const handleFocus = () => {
        if (Platform.isTV) {
            setIsFocused(true);
            Animated.spring(scale, {
                toValue: 1.1, // Increased scale for better visibility
                friction: 3,
                useNativeDriver: true,
            }).start();
            if (onFocus) onFocus();
        }
    };

    const handleBlur = () => {
        if (Platform.isTV) {
            setIsFocused(false);
            Animated.spring(scale, {
                toValue: 1,
                friction: 3,
                useNativeDriver: true,
            }).start();
            if (onBlur) onBlur();
        }
    };

    const { primary } = useThemeStore(state => state);

    // Default focus style if none provided
    const defaultFocusStyle: StyleProp<ViewStyle> = {
        borderColor: primary || '#ffffff', // Use primary color or white
        borderWidth: 3,
        borderRadius: 8, // Add some rounding
        // backgroundColor: 'rgba(255, 255, 255, 0.1)', // Subtle highlight
        shadowColor: primary || '#ffffff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        zIndex: 99,
    };

    return (
        <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
            <TouchableOpacity
                onFocus={handleFocus}
                onBlur={handleBlur}
                activeOpacity={0.7}
                focusable={true} // Ensure it's focusable on Android TV
                {...props}
                style={[
                    style,
                    isFocused && (focusedStyle || defaultFocusStyle),
                ]}
            >
                {children}
            </TouchableOpacity>
        </Animated.View>
    );
};

export default TVFocusWrapper;
