import React, { useState } from 'react';
import { StyleProp, ViewStyle, Animated, Platform, Pressable, PressableProps } from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';

interface TVFocusWrapperProps extends PressableProps {
    children: React.ReactNode;
    focusedStyle?: StyleProp<ViewStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    onFocus?: () => void;
    onBlur?: () => void;
    style?: StyleProp<ViewStyle>;
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
    const { primary } = useThemeStore(state => state);

    const handleFocus = () => {
        setIsFocused(true);
        Animated.spring(scale, {
            toValue: 1.1,
            friction: 3,
            useNativeDriver: true,
        }).start();
        if (onFocus) onFocus();
    };

    const handleBlur = () => {
        setIsFocused(false);
        Animated.spring(scale, {
            toValue: 1,
            friction: 3,
            useNativeDriver: true,
        }).start();
        if (onBlur) onBlur();
    };

    // Default focus style
    const defaultFocusStyle: StyleProp<ViewStyle> = {
        borderColor: primary || '#ffffff',
        borderWidth: 4, // Increased for visibility
        borderRadius: 8,
        borderStyle: 'solid',
        shadowColor: primary || '#ffffff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 10, // High elevation for Android visibility
        zIndex: 999,   // Ensure it sits on top
    };

    return (
        <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
            <Pressable
                onFocus={handleFocus}
                onBlur={handleBlur}
                {...props}
                style={[
                    style,
                    isFocused && (focusedStyle || defaultFocusStyle),
                ]}
            >
                {children}
            </Pressable>
        </Animated.View>
    );
};

export default TVFocusWrapper;
