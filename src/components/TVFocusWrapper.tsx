import React, { useState } from 'react';
import { TouchableOpacity, StyleProp, ViewStyle, Animated, GestureResponderEvent, TouchableOpacityProps } from 'react-native';

interface TVFocusWrapperProps extends TouchableOpacityProps {
    children: React.ReactNode;
    focusedStyle?: StyleProp<ViewStyle>;
    onFocus?: () => void;
    onBlur?: () => void;
}

const TVFocusWrapper: React.FC<TVFocusWrapperProps> = ({
    children,
    style,
    focusedStyle,
    onFocus,
    onBlur,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [scale] = useState(new Animated.Value(1));

    const handleFocus = () => {
        setIsFocused(true);
        Animated.spring(scale, {
            toValue: 1.05,
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

    // Default focus style if none provided
    const defaultFocusStyle: StyleProp<ViewStyle> = {
        borderColor: 'white',
        borderWidth: 2,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    };

    return (
        <Animated.View style={[{ transform: [{ scale }] }]}>
            <TouchableOpacity
                onFocus={handleFocus}
                onBlur={handleBlur}
                activeOpacity={0.7}
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
