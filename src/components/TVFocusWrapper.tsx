import React, { useState } from 'react';
import { TouchableOpacity, StyleProp, ViewStyle, Animated, GestureResponderEvent, TouchableOpacityProps, Platform } from 'react-native';

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

    // Default focus style if none provided
    const defaultFocusStyle: StyleProp<ViewStyle> = {
        borderColor: '#FF0000', // Red border for high contrast (matches logo)
        borderWidth: 4, // Thicker border
        backgroundColor: '#333333', // Lighter background to highlight
        elevation: 10,
        shadowColor: '#FF0000', // Colored shadow/glow
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
        zIndex: 999, // Ensure it pops on top
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
